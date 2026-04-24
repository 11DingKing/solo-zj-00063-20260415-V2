import { IOrder } from "./order";

export type UserRole = "user" | "merchant" | "admin";

export interface IUser {
  orders: IOrder[];
  username: string;
  email: string;
  address: string;
  phone: string;
  id: string;
  token: string;
  role: UserRole;
}
