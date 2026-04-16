#!/usr/bin/env node

const API_BASE = process.env.API_BASE || "http://localhost:5073/api";
const PASSWORD = process.env.SEED_PASSWORD || "12345678";
const now = new Date();
const suffix = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");

async function apiRequest(path, { method = "GET", token, body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const raw = await res.text();
    let data = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = raw;
    }

    if (!res.ok) {
        const detail = typeof data === "string" ? data : JSON.stringify(data);
        throw new Error(`${method} ${path} failed (${res.status}): ${detail}`);
    }

    return data;
}

function futureIso(hoursFromNow) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

async function registerUser({ name, email, role }) {
    const data = await apiRequest("/auth/register", {
        method: "POST",
        body: { name, email, password: PASSWORD, role },
    });

    return {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        accessToken: data.tokens.accessToken,
    };
}

async function loginUser(email, password) {
    const data = await apiRequest("/auth/login", {
        method: "POST",
        body: { email, password },
    });

    return data.tokens;
}

async function logout(accessToken, refreshToken) {
    await apiRequest("/auth/logout", {
        method: "POST",
        token: accessToken,
        body: { refreshToken },
    });
}

async function verifyHandymen() {
    console.log("Fetching pending verifications...");

    const adminToken = await loginUser("admin@neighborhelp.test", "Password123!");

    const response = await apiRequest("/admin/handymen/pending-verification", {
        token: adminToken.accessToken,
        method: "GET"
    });

    const pendingList = response.data || [];

    if (pendingList.length === 0) {
        console.log("No pending verifications found.");
        return;
    }

    for (const v of pendingList) {
        if (v.userName === "Handyman No verification") {
            console.log(`Leaving Handyman as Pending: ${v.userName}`);
            continue;
        }

        if (v.userName === "Handyman Rejected") {
            await apiRequest(`/admin/handymen/${v.id}/reject`, {
                method: "PATCH",
                token: adminToken.accessToken,
                body: "Identity document was blurry."
            });
            console.log(`Rejected Handyman: ${v.userName}`);
        } else {
            await apiRequest(`/admin/handymen/${v.id}/approve`, {
                method: "PATCH",
                token: adminToken.accessToken,
                body: "Verified via automated seed script."
            });
            console.log(`Approved Handyman: ${v.userName}`);
        }
    }

    await logout(adminToken.accessToken, adminToken.refreshToken);
    console.log("Admin logged out.");
}

async function main() {
    console.log(`API base: ${API_BASE}`);

    const userBlueprint = [
        { name: "Homeowner A", email: `ha-${suffix}@nh.test`, role: "homeowner" },
        { name: "Homeowner B", email: `hb-${suffix}@nh.test`, role: "homeowner" },
        { name: "Handyman A", email: `ma-${suffix}@nh.test`, role: "handyman" },
        { name: "Handyman B", email: `mb-${suffix}@nh.test`, role: "handyman" },
        { name: "Handyman Rejected", email: `rr-${suffix}@nh.test`, role: "handyman" },
        { name: "Handyman No verification", email: `nn-${suffix}@nh.test`, role: "handyman" },
    ];

    const users = [];
    for (const u of userBlueprint) {
        const created = await registerUser(u);
        users.push(created);
    }

    const homeowners = users.filter((u) => u.role === "homeowner");
    const allHandymen = users.filter((u) => u.role === "handyman");

    await verifyHandymen();

    const verifiedHandymen = allHandymen.filter((h) => {
        return h.name !== "Handyman Rejected" && h.name !== "Handyman No verification";
    });

    const jobBlueprint = [
        { title: `Leaking sink pipe ${suffix}`, category: "Plumbing", budget: 180, isEmergency: false },
        { title: `Ceiling fan repair ${suffix}`, category: "Electrical", budget: 220, isEmergency: false },
        { title: `Cabinet replacement ${suffix}`, category: "Carpentry", budget: 140, isEmergency: false },
        { title: `Washing machine fix ${suffix}`, category: "Appliance Repair", budget: 260, isEmergency: true },
    ];

    const jobs = [];
    for (let i = 0; i < jobBlueprint.length; i += 1) {
        const owner = homeowners[i % homeowners.length];
        const createdJob = await apiRequest("/jobs", {
            method: "POST",
            token: owner.accessToken,
            body: { ...jobBlueprint[i], description: "Seeded job description", location: "Kuala Lumpur" },
        });
        jobs.push({ ...createdJob, owner });
    }

    console.log(`Placing bids using ${verifiedHandymen.length} verified handymen...`);
    for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        const handyman = verifiedHandymen[i % verifiedHandymen.length];

        try {
            // 1. Place Bid
            const bid = await apiRequest(`/jobs/${job.id}/bids`, {
                method: "POST",
                token: handyman.accessToken,
                body: { price: 150, estimatedArrival: futureIso(24), message: "I can do this!" },
            });

            // 2. Accept Bid
            await apiRequest(`/bids/${bid.id}/accept`, {
                method: "PATCH",
                token: job.owner.accessToken,
            });

            // 3. Create Rating
            await apiRequest(`/ratings`, {
                method: "POST",
                token: job.owner.accessToken,
                body: {
                    targetUserId: handyman.id,
                    score: 5,
                    comment: "Excellent work! Highly recommended."
                }
            });
            console.log(`Successfully processed cycle for: ${handyman.name}`);
        } catch (err) {
            console.error(`Error during bidding for ${handyman.name}: ${err.message}`);
        }
    }

    console.log("\nSeed completed successfully.");
}

main().catch((err) => {
    console.error("Seed via API failed:");
    console.error(err.message || err);
    process.exit(1);
});