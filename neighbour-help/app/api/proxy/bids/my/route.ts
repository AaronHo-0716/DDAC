import { NextRequest, NextResponse } from "next/server";

interface RawUserDto {
  id?: string | null;
  role?: string | null;
}

interface RawBidDto {
  id?: string | null;
  jobId?: string | null;
  handyman?: RawUserDto | null;
  status?: string | null;
  createdAt?: string | null;
}

interface RawBidListResponse {
  bids?: RawBidDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

interface RawJobDto {
  id?: string | null;
}

interface RawJobListResponse {
  jobs?: RawJobDto[] | null;
  page?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}

const BACKEND_BASE = `${process.env.API_URL ?? "http://localhost:5073"}/api`;
const MAX_PAGES = 20;
const FETCH_PAGE_SIZE = 100;

function buildBackendHeaders(request: NextRequest): HeadersInit {
  const authHeader = request.headers.get("authorization");
  let headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (authHeader) {
    headers = {
      ...headers,
      Authorization: authHeader,
    };
  }

  return headers;
}

async function fetchBackendJson<T>(
  request: NextRequest,
  path: string,
): Promise<{ response: Response; data: T | null }> {
  const response = await fetch(`${BACKEND_BASE}${path}`, {
    method: "GET",
    headers: buildBackendHeaders(request),
    cache: "no-store",
  });

  const text = await response.text();
  if (!text) {
    return { response, data: null };
  }

  try {
    return { response, data: JSON.parse(text) as T };
  } catch {
    return { response, data: null };
  }
}

function normalizeStatus(value?: string | null): "pending" | "accepted" | "rejected" {
  const status = (value ?? "pending").toLowerCase();
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  return "pending";
}

async function collectJobsByStatus(request: NextRequest, status: string): Promise<string[]> {
  const jobIds = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { response, data } = await fetchBackendJson<RawJobListResponse>(
      request,
      `/jobs?page=${page}&pageSize=${FETCH_PAGE_SIZE}&status=${encodeURIComponent(status)}`,
    );

    if (!response.ok || !data) {
      break;
    }

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    jobs.forEach((job) => {
      if (job.id) jobIds.add(job.id);
    });

    const totalCount = data.totalCount ?? jobs.length;
    if (page * FETCH_PAGE_SIZE >= totalCount) {
      break;
    }
  }

  return Array.from(jobIds);
}

async function collectHandymanBids(
  request: NextRequest,
  handymanId: string,
): Promise<RawBidDto[]> {
  const statuses = ["open", "in-progress", "completed"];
  const jobIds = new Set<string>();

  for (const status of statuses) {
    const ids = await collectJobsByStatus(request, status);
    ids.forEach((id) => jobIds.add(id));
  }

  const bids: RawBidDto[] = [];
  const orderedJobIds = Array.from(jobIds);

  for (const jobId of orderedJobIds) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { response, data } = await fetchBackendJson<RawBidListResponse>(
        request,
        `/jobs/${encodeURIComponent(jobId)}/bids?page=${page}&pageSize=${FETCH_PAGE_SIZE}`,
      );

      if (!response.ok || !data) {
        break;
      }

      const pageBids = Array.isArray(data.bids) ? data.bids : [];
      pageBids
        .filter((bid) => bid.handyman?.id === handymanId)
        .forEach((bid) => {
          bids.push({
            ...bid,
            jobId: bid.jobId ?? jobId,
            status: normalizeStatus(bid.status),
          });
        });

      const totalCount = data.totalCount ?? pageBids.length;
      if (page * FETCH_PAGE_SIZE >= totalCount) {
        break;
      }
    }
  }

  return bids;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10);
  const status = url.searchParams.get("status")?.toLowerCase();

  // If backend already supports /api/bids/my, forward directly.
  const query = url.searchParams.toString();
  const passthroughPath = `/bids/my${query ? `?${query}` : ""}`;
  const direct = await fetch(`${BACKEND_BASE}${passthroughPath}`, {
    method: "GET",
    headers: buildBackendHeaders(request),
    cache: "no-store",
  });

  if (direct.ok) {
    const text = await direct.text();
    return new NextResponse(text, {
      status: direct.status,
      headers: {
        "Content-Type": direct.headers.get("content-type") ?? "application/json",
      },
    });
  }

  // Fallback for backends that haven't implemented GET /api/bids/my yet.
  if (direct.status !== 404 && direct.status !== 405) {
    const text = await direct.text();
    return new NextResponse(text || JSON.stringify({ message: "Failed to fetch bids." }), {
      status: direct.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const me = await fetchBackendJson<RawUserDto>(request, "/auth/me");
  if (!me.response.ok || !me.data?.id) {
    return NextResponse.json(
      { message: "Unable to resolve current user." },
      { status: me.response.status || 401 },
    );
  }

  if ((me.data.role ?? "").toLowerCase() !== "handyman") {
    return NextResponse.json(
      { message: "Only handymen can access submitted bids." },
      { status: 403 },
    );
  }

  const allBids = await collectHandymanBids(request, me.data.id);
  const filteredBids = status
    ? allBids.filter((bid) => normalizeStatus(bid.status) === status)
    : allBids;

  filteredBids.sort((a, b) => {
    const aTs = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTs = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTs - aTs;
  });

  const totalCount = filteredBids.length;
  const start = (page - 1) * pageSize;
  const bids = filteredBids.slice(start, start + pageSize);

  return NextResponse.json({
    bids,
    page,
    pageSize,
    totalCount,
  });
}