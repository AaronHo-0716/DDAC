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

    // Log in as admin
    const adminToken = await loginUser("admin@NeighborHelp.test", "Password123!");

    const pendingList = await apiRequest("/admin/handymen/pending-verification", {
        token: adminToken.accessToken,
        method: "GET"
    });

    if (!pendingList || pendingList.length === 0) {
        console.log("No pending verifications found.");
        return;
    }

    for (const v of pendingList) {
        if (v.userName != "Handyman No verification") {
            if (v.userName != "Handyman Rejected") {
                await apiRequest(`/admin/handymen/${v.id}/approve`, {
                    method: "PATCH",
                    token: adminToken.accessToken,
                    body: "Verified via automated seed script."
                });
                console.log(`Approved Handyman: ${v.userName} (ID: ${v.userId})`);
            } else {
                await apiRequest(`/admin/handymen/${v.id}/reject`, {
                    method: "PATCH",
                    token: adminToken.accessToken,
                    body: "Verified via automated seed script."
                });
                console.log(`Rejected Handyman: ${v.userName} (ID: ${v.userId})`);
            } 
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
    const handymen = users.filter((u) => u.role === "handyman");

    await verifyHandymen();

    const jobBlueprint = [
        {
            title: `Leaking sink pipe ${suffix}`,
            description: "Kitchen sink has a persistent leak. Need inspection and fix.",
            category: "Plumbing",
            location: "TTDI, Kuala Lumpur",
            budget: 180,
            isEmergency: false,
        },
        {
            title: `Ceiling fan not spinning ${suffix}`,
            description: "Bedroom fan wiring issue, fan stops after a few seconds.",
            category: "Electrical",
            location: "Bangsar, Kuala Lumpur",
            budget: 220,
            isEmergency: false,
        },
        {
            title: `Cabinet hinge replacement ${suffix}`,
            description: "Kitchen cabinet hinge is broken and door is misaligned.",
            category: "Carpentry",
            location: "Cheras, Kuala Lumpur",
            budget: 140,
            isEmergency: false,
        },
        {
            title: `Washing machine drain issue ${suffix}`,
            description: "Washer does not drain after cycle, likely pump blockage.",
            category: "Appliance Repair",
            location: "Setapak, Kuala Lumpur",
            budget: 260,
            isEmergency: true,
        },
        {
            title: `Bathroom fixture tightening ${suffix}`,
            description: "Multiple loose fixtures in bathroom need tightening.",
            category: "General Maintenance",
            location: "Ampang, Kuala Lumpur",
            budget: 120,
            isEmergency: false,
        },
        {
            title: `Power socket replacement ${suffix}`,
            description: "Wall socket is loose and has burn marks.",
            category: "Electrical",
            location: "Mont Kiara, Kuala Lumpur",
            budget: 200,
            isEmergency: true,
        },
    ];

    const jobs = [];
    for (let i = 0; i < jobBlueprint.length; i += 1) {
        const owner = homeowners[i % homeowners.length];
        const body = {
            ...jobBlueprint[i],
            latitude: 3.14 + i * 0.001,
            longitude: 101.69 + i * 0.001,
            imageUrls: [],
        };

        const createdJob = await apiRequest("/jobs", {
            method: "POST",
            token: owner.accessToken,
            body,
        });

        jobs.push({ ...createdJob, ownerId: owner.id, ownerEmail: owner.email });
    }

    const bids = [];
    for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        const bidOne = await apiRequest(`/jobs/${job.id}/bids`, {
            method: "POST",
            token: handymen[0].accessToken,
            body: {
                price: Math.max(60, Number(job.budget || 200) - 20),
                estimatedArrival: futureIso(24 + i),
                message: "I can handle this job with proper tools and clear pricing.",
            },
        });

        const bidTwo = await apiRequest(`/jobs/${job.id}/bids`, {
            method: "POST",
            token: handymen[1].accessToken,
            body: {
                price: Math.max(70, Number(job.budget || 200) - 10),
                estimatedArrival: futureIso(26 + i),
                message: "Available soon and experienced with similar fixes.",
            },
        });

        bids.push({ jobId: job.id, ownerId: job.ownerId, bidIds: [bidOne.id, bidTwo.id] });
    }

    for (let i = 0; i < bids.length; i += 1) {
        const b = bids[i];
        const owner = homeowners.find((h) => h.id === b.ownerId);
        if (!owner) continue;

        if (i < 2) {
            await apiRequest(`/bids/${b.bidIds[0]}/accept`, {
                method: "PATCH",
                token: owner.accessToken,
            });
        } else if (i === 2) {
            await apiRequest(`/bids/${b.bidIds[1]}/reject`, {
                method: "PATCH",
                token: owner.accessToken,
            });
        }
    }

    console.log("\nSeed via API completed successfully.");
    console.log(`Created users: ${users.length}`);
    console.log(`Created jobs: ${jobs.length}`);
    console.log(`Created bids: ${jobs.length * 2}`);
    console.log("\nLogin credentials for new users:");
    for (const u of users) {
        console.log(`- ${u.role}: ${u.email} / ${PASSWORD}`);
    }
}

main().catch((err) => {
    console.error("Seed via API failed:");
    console.error(err.message || err);
    process.exit(1);
});
