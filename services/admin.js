import api from "./api";

export async function getCentralDashboard() {
  const res = await api.get("/central/dashboard");
  return res.data;
}

// compatibilidade temporária
export async function getAdminDashboard() {
  const res = await api.get("/central/dashboard");
  return res.data;
}