// ==========================================
// 1. BASE CONFIGURATION
// ==========================================
const API_BASE = "https://teampulse-api-backend-prod.azurewebsites.net/api";

// --- HELPER: Handle Responses ---
async function handleResponse(response) {
    if (!response.ok) {
        const errorText = await response.text();
        try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.message || errorJson.body || errorText || "API Request Failed");
        } catch (e) {
            throw new Error(errorText || "API Request Failed");
        }
    }
    if (response.status === 204) return null;
    return response.json();
}

// ==========================================
// 2. AUTHENTICATION & USER MANAGEMENT
// ==========================================
export async function login(credentials) {
    const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
    });
    return handleResponse(res);
}

export const loginUser = login;

export async function fetchUsers() {
    const res = await fetch(`${API_BASE}/getUsers`);
    return handleResponse(res);
}

export async function createUser(userData) {
    const res = await fetch(`${API_BASE}/manageUsers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
    });
    return handleResponse(res);
}

export async function deleteUser(id) {
    const res = await fetch(`${API_BASE}/manageUsers?id=${id}`, {
        method: 'DELETE'
    });
    return handleResponse(res);
}

/**
 * FIXED: This points to the specialized Azure Function that hashes 
 * the password using Bcrypt before saving to Cosmos DB.
 */
export const resetUserPassword = async (userId, newPassword) => {
    const response = await fetch(`${API_BASE}/resetPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword })
    });
    return handleResponse(response);
};

// ==========================================
// 3. TRACKING & LOGS
// ==========================================

/**
 * FIXED: Renamed to updateStatus to match the Azure Function 
 * exported name. Used by both the Web and Desktop app.
 */
export async function sendHeartbeat(userId, status) {
    fetch(`${API_BASE}/updateStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status })
    }).catch(err => console.error("Heartbeat failed", err));
}

export async function saveLog(type, data) {
    const res = await fetch(`${API_BASE}/logActivity?type=${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(res);
}

export async function fetchLogs(type, date, userId = null) {
    let url = `${API_BASE}/getLogs?type=${type}&date=${date}`;
    if (userId) url += `&userId=${userId}`;
    const res = await fetch(url);
    return handleResponse(res);
}

export async function fetchHistory(userId, fullname, startDate) {
    const res = await fetch(`${API_BASE}/getHistory?userId=${userId}&fullname=${fullname}&startDate=${startDate}`);
    return handleResponse(res);
}

// ==========================================
// 4. TASKS
// ==========================================
export async function fetchTasks(assignedTo = null, date = null) {
    const params = new URLSearchParams();
    if (assignedTo) {
        params.append('assignedTo', assignedTo);
        params.append('user', assignedTo); // Support legacy param
    }
    if (date) params.append('date', date);

    const res = await fetch(`${API_BASE}/getTasks?${params.toString()}`);
    return handleResponse(res);
}

export async function saveTask(task) {
    const res = await fetch(`${API_BASE}/saveTask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    return handleResponse(res);
}

export async function deleteTask(id, assignedTo) {
    const params = new URLSearchParams({ id, assignedTo });
    const res = await fetch(`${API_BASE}/deleteTask?${params.toString()}`, {
        method: 'DELETE'
    });
    return handleResponse(res);
}

// ==========================================
// 5. PROJECTS & LEAVES
// ==========================================
export async function fetchProjects() {
    const res = await fetch(`${API_BASE}/manageProjects`);
    return handleResponse(res);
}

export async function saveProject(data) {
    const res = await fetch(`${API_BASE}/manageProjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(res);
}

export async function deleteProject(id) {
    const res = await fetch(`${API_BASE}/manageProjects?id=${id}`, {
        method: 'DELETE'
    });
    return handleResponse(res);
}

export async function fetchLeaves(userId = null) {
    let url = `${API_BASE}/manageLeaves`;
    if (userId) url += `?userId=${userId}`;
    const res = await fetch(url);
    return handleResponse(res);
}

export async function requestLeave(data) {
    const res = await fetch(`${API_BASE}/manageLeaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(res);
}

export async function updateLeaveStatus(id, userId, status, adminNote) {
    const res = await fetch(`${API_BASE}/manageLeaves`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userId, status, adminNote })
    });
    return handleResponse(res);
}

export async function deleteLeave(id, userId) {
    const res = await fetch(`${API_BASE}/manageLeaves?id=${id}&userId=${userId}`, {
        method: 'DELETE'
    });
    if (res.status === 204) return true;
    return res.json();
}

// ==========================================
// 6. ACADEMY, SETTINGS & CRM
// ==========================================
export async function fetchTrainings(assignedTo = null) {
    let url = `${API_BASE}/manageTrainings`;
    if (assignedTo) url += `?assignedTo=${assignedTo}`;
    const res = await fetch(url);
    return handleResponse(res);
}

export async function assignTraining(data) {
    const res = await fetch(`${API_BASE}/manageTrainings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(res);
}

export async function fetchSettings(key) {
    const res = await fetch(`${API_BASE}/manageSettings?key=${key}`);
    return handleResponse(res);
}

export async function saveSettings(key, data) {
    const res = await fetch(`${API_BASE}/manageSettings?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(res);
}

export async function fetchLeads() {
    return handleResponse(await fetch(`${API_BASE}/manageLeads`));
}

export async function saveLead(data) {
    return handleResponse(await fetch(`${API_BASE}/manageLeads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    }));
}

export async function fetchInvoices() {
    return handleResponse(await fetch(`${API_BASE}/manageInvoices`));
}