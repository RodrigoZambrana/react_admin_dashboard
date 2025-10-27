import axios from "@lib/axios";
import User from "models/user.model";

export const getUser = async (): Promise<User> => {
  const response = await axios.get("/api/user-list/1");
  return response.data;
};

export const getUserIds = async (): Promise<{ id: string }[]> => {
  const response = await axios.get("/api/user-list/id-list");
  return response.data;
};

export default { getUser, getUserIds };
