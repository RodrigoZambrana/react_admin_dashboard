"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer
} from "react";

import type {
  CheckoutSnapshotPayload,
  OrderSummary,
  StorefrontFulfillmentMode,
  StorefrontShippingOption
} from "@/types/storefront";
import { isMercadoPagoPaymentConfirmed } from "@/utils/mercadopago";
import {
  clearPersistedCheckoutState,
  loadPersistedCheckoutState,
  savePersistedCheckoutState
} from "@/utils/checkoutStorage";
import { useSession } from "./session-context";

type CheckoutStep = "details" | "payment";

export type CheckoutContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export type CheckoutAddress = {
  line1: string;
  line2?: string;
  street?: string;
  number?: string;
  corner?: string;
  apartment?: string;
  comments?: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
};

export type CheckoutPayment =
  | {
      method: "mercadopago";
      paymentIntentId: string;
      paymentId?: string;
      status: "approved" | "authorized" | "in_process" | "pending" | "processing" | "rejected";
      statusDetail?: string;
      currency: string;
      amount: number;
      installments?: number;
      cardBrand?: string;
      cardLastFour?: string;
      cardholderName?: string;
      checkoutSnapshot?: CheckoutSnapshotPayload;
      updatedAt?: string;
    }
  | {
      method: "cod";
    };

interface CheckoutState {
  contact: CheckoutContact;
  shippingAddress: CheckoutAddress;
  fulfillmentMode: StorefrontFulfillmentMode;
  shippingOption: StorefrontShippingOption | null;
  payment: CheckoutPayment | null;
  notes: string;
  completed: Record<CheckoutStep, boolean>;
  prefilledCustomerId: number | null;
  lastOrder?: OrderSummary | null;
  checkoutToken: string;
}

type CheckoutAction =
  | {
      type: "SET_DETAILS";
      payload: {
        contact: CheckoutContact;
        shippingAddress: CheckoutAddress;
        fulfillmentMode: StorefrontFulfillmentMode;
        shippingOption: StorefrontShippingOption;
      };
    }
  | { type: "SET_PAYMENT"; payload: CheckoutPayment }
  | { type: "CLEAR_PAYMENT" }
  | { type: "SET_NOTES"; payload: string }
  | { type: "RESET" }
  | {
      type: "PREFILL_FROM_SESSION";
      payload: {
        customerId?: number;
        contact?: Partial<CheckoutContact>;
        shippingAddress?: Partial<CheckoutAddress>;
      };
    }
  | {
      type: "HYDRATE";
      payload: Partial<CheckoutState>;
    }
  | { type: "SET_LAST_ORDER"; payload: OrderSummary | null };

const generateCheckoutToken = (): string => {
  const cryptoSource =
    typeof globalThis !== "undefined" && (globalThis as { crypto?: Crypto }).crypto
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;
  if (cryptoSource?.randomUUID) {
    return cryptoSource.randomUUID();
  }
  return `chk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const createInitialState = (): CheckoutState => ({
  contact: {
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  },
  shippingAddress: {
    line1: "",
    line2: "",
    street: "",
    number: "",
    corner: "",
    apartment: "",
    comments: "",
    city: "",
    state: "",
    zip: "",
    country: ""
  },
  fulfillmentMode: "home_delivery",
  shippingOption: null,
  payment: null,
  notes: "",
  completed: {
    details: false,
    payment: false
  },
  prefilledCustomerId: null,
  lastOrder: null,
  checkoutToken: generateCheckoutToken()
});

const initialState: CheckoutState = createInitialState();

const mergeIfEmpty = (current: string, next?: string | null): string => {
  if (current && current.trim().length > 0) {
    return current;
  }
  if (!next) {
    return current;
  }
  return next;
};

const checkoutReducer = (state: CheckoutState, action: CheckoutAction): CheckoutState => {
  switch (action.type) {
    case "SET_DETAILS": {
      return {
        ...state,
        contact: action.payload.contact,
        shippingAddress: action.payload.shippingAddress,
        fulfillmentMode: action.payload.fulfillmentMode,
        shippingOption: action.payload.shippingOption,
        completed: {
          ...state.completed,
          details: Boolean(action.payload.shippingOption?.id)
        }
      };
    }
    case "SET_PAYMENT": {
      const payment = action.payload;
      const paymentCompleted =
        payment.method === "cod" ||
        (payment.method === "mercadopago" &&
          Boolean(payment.paymentIntentId) &&
          isMercadoPagoPaymentConfirmed(payment.status));
      return {
        ...state,
        payment,
        completed: { ...state.completed, payment: paymentCompleted }
      };
    }
    case "CLEAR_PAYMENT": {
      return {
        ...state,
        payment: null,
        completed: { ...state.completed, payment: false }
      };
    }
    case "SET_NOTES": {
      return { ...state, notes: action.payload };
    }
    case "RESET": {
      return createInitialState();
    }
    case "HYDRATE": {
      return {
        ...state,
        ...action.payload,
        completed: {
          ...state.completed,
          ...(action.payload.completed ?? {})
        }
      };
    }
    case "PREFILL_FROM_SESSION": {
      const customerId = action.payload.customerId ?? null;
      if (customerId && state.prefilledCustomerId === customerId) {
        return state;
      }

      const nextContact: CheckoutContact = {
        ...state.contact,
        firstName: mergeIfEmpty(state.contact.firstName, action.payload.contact?.firstName),
        lastName: mergeIfEmpty(state.contact.lastName, action.payload.contact?.lastName),
        email: mergeIfEmpty(state.contact.email, action.payload.contact?.email),
        phone: mergeIfEmpty(state.contact.phone ?? "", action.payload.contact?.phone)
      };

      const nextShipping: CheckoutAddress = {
        ...state.shippingAddress,
        line1: mergeIfEmpty(state.shippingAddress.line1, action.payload.shippingAddress?.line1),
        line2: mergeIfEmpty(state.shippingAddress.line2 ?? "", action.payload.shippingAddress?.line2),
        city: mergeIfEmpty(state.shippingAddress.city, action.payload.shippingAddress?.city),
        state: mergeIfEmpty(state.shippingAddress.state ?? "", action.payload.shippingAddress?.state),
        zip: mergeIfEmpty(state.shippingAddress.zip ?? "", action.payload.shippingAddress?.zip),
        country: mergeIfEmpty(
          state.shippingAddress.country,
          action.payload.shippingAddress?.country
        )
      };

      return {
        ...state,
        contact: nextContact,
        shippingAddress: nextShipping,
        prefilledCustomerId: customerId
      };
    }
    case "SET_LAST_ORDER": {
      return { ...state, lastOrder: action.payload };
    }
    default:
      return state;
  }
};

interface CheckoutContextValue {
  contact: CheckoutContact;
  shippingAddress: CheckoutAddress;
  fulfillmentMode: StorefrontFulfillmentMode;
  shippingOption: StorefrontShippingOption | null;
  payment: CheckoutPayment | null;
  notes: string;
  completed: Record<CheckoutStep, boolean>;
  lastOrder?: OrderSummary | null;
  checkoutToken: string;
  hasDetails: boolean;
  hasPayment: boolean;
  setDetails: (
    contact: CheckoutContact,
    shippingAddress: CheckoutAddress,
    fulfillmentMode: StorefrontFulfillmentMode,
    shippingOption: StorefrontShippingOption
  ) => void;
  setPayment: (payment: CheckoutPayment) => void;
  clearPayment: () => void;
  setNotes: (notes: string) => void;
  reset: () => void;
  setLastOrder: (order: OrderSummary | null) => void;
}

const CheckoutContext = createContext<CheckoutContextValue | undefined>(undefined);

export const StorefrontCheckoutProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [state, dispatch] = useReducer(checkoutReducer, initialState);
  const { session, status } = useSession();

  useEffect(() => {
    const persisted = loadPersistedCheckoutState();
    if (!persisted) {
      return;
    }

    dispatch({
      type: "HYDRATE",
      payload: persisted
    });
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session) {
      return;
    }

    const { customer } = session;
    const contact = {
      firstName: customer.firstName ?? "",
      lastName: customer.lastName ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? ""
    };

    const primaryAddress =
      customer.addresses.find((address) => address.isPrimary) ?? customer.addresses[0];

    const shippingAddress = primaryAddress
      ? {
          line1: primaryAddress.line1 ?? "",
          line2: primaryAddress.line2 ?? "",
          city: primaryAddress.city ?? "",
          state: primaryAddress.state ?? "",
          zip: primaryAddress.zip ?? "",
          country: primaryAddress.country ?? ""
        }
      : undefined;

    dispatch({
      type: "PREFILL_FROM_SESSION",
      payload: {
        customerId: customer.id,
        contact,
        shippingAddress
      }
    });
  }, [session, status]);

  const setDetails = useCallback(
    (
      contact: CheckoutContact,
      shippingAddress: CheckoutAddress,
      fulfillmentMode: StorefrontFulfillmentMode,
      shippingOption: StorefrontShippingOption
    ) => {
      dispatch({
        type: "SET_DETAILS",
        payload: { contact, shippingAddress, fulfillmentMode, shippingOption }
      });
    },
    []
  );

  const setPayment = useCallback((payment: CheckoutPayment) => {
    dispatch({ type: "SET_PAYMENT", payload: payment });
  }, []);

  const clearPayment = useCallback(() => {
    dispatch({ type: "CLEAR_PAYMENT" });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: "SET_NOTES", payload: notes });
  }, []);

  const setLastOrder = useCallback((order: OrderSummary | null) => {
    dispatch({ type: "SET_LAST_ORDER", payload: order });
  }, []);

  const reset = useCallback(() => {
    clearPersistedCheckoutState();
    dispatch({ type: "RESET" });
  }, []);

  useEffect(() => {
    savePersistedCheckoutState({
      contact: state.contact,
      shippingAddress: state.shippingAddress,
      fulfillmentMode: state.fulfillmentMode,
      shippingOption: state.shippingOption,
      payment: state.payment,
      notes: state.notes,
      completed: state.completed,
      lastOrder: state.lastOrder,
      checkoutToken: state.checkoutToken
    });
  }, [state]);

  const value = useMemo<CheckoutContextValue>(
    () => ({
      contact: state.contact,
      shippingAddress: state.shippingAddress,
      fulfillmentMode: state.fulfillmentMode,
      shippingOption: state.shippingOption,
      payment: state.payment,
      notes: state.notes,
      completed: state.completed,
      lastOrder: state.lastOrder,
      checkoutToken: state.checkoutToken,
      hasDetails: state.completed.details,
      hasPayment: state.completed.payment,
      setDetails,
      setPayment,
      clearPayment,
      setNotes,
      reset,
      setLastOrder
    }),
    [state, setDetails, setPayment, clearPayment, setNotes, reset, setLastOrder]
  );

  return <CheckoutContext.Provider value={value}>{children}</CheckoutContext.Provider>;
};

export const useCheckout = (): CheckoutContextValue => {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error("useCheckout must be used within a StorefrontCheckoutProvider");
  }
  return context;
};
