import axios from "@lib/axios";
import Ticket from "models/Ticket.model";

export const getTicketList = async (): Promise<Ticket[]> => {
  const response = await axios.get("/api/tickets");
  return response.data;
};

export const getTicket = async (slug: string): Promise<Ticket> => {
  const response = await axios.get("/api/tickets/single", { params: { slug } });
  return response.data;
};

export const getSlugs = async (): Promise<{ slug: string }[]> => {
  const response = await axios.get("/api/tickets/slugs");
  return response.data;
};

export default { getTicketList, getTicket, getSlugs };
