import axios from "@lib/axios";
import Address from "models/address.model";

const getAddressList = async (): Promise<Address[]> => {
  const response = await axios.get("/api/address/user");
  return response.data;
};

const getIds = async (): Promise<{ id: string }[]> => {
  const response = await axios.get("/api/address/address-ids");
  return response.data;
};

const getAddress = async (id: string): Promise<Address> => {
  const response = await axios.get("/api/address/user/1", { params: { id } });
  return response.data;
};

export default { getAddressList, getIds, getAddress };
