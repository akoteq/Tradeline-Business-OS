import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ,
  headers: { "Content-Type": "application/json" },
});

export const fetcher = (url: string) => api.get(url).then((r) => r.data);
