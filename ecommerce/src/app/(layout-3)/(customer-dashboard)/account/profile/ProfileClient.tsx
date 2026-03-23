"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { format } from "date-fns/format";
import { IconUserFilled } from "@tabler/icons-react";

import Box from "@component/Box";
import Card from "@component/Card";
import Avatar from "@component/avatar";
import Grid from "@component/grid/Grid";
import FlexBox from "@component/FlexBox";
import TableRow from "@component/TableRow";
import { Button } from "@component/buttons";
import Typography, { H3, H5, Small } from "@component/Typography";
import DashboardPageHeader from "@component/DashboardPageHeader";

import Spinner from "@component/Spinner";

import { useAccountProfile } from "@/hooks/useAccountProfile";
import { useAccountOrders } from "@/hooks/useAccountOrders";
import { useTranslation } from "@/state/i18n-context";
import { StorefrontApi, isApiError } from "@/lib/api/storefront";
import { extractApiErrorMessage } from "@/lib/api/errors";
import { useToast } from "@/contexts/ToastContext";

const FALLBACK_AVATAR = "/assets/images/faces/ralph.png";

export default function ProfileClient() {
  const { profile, loading, error, refresh, updateLocalProfile, token } = useAccountProfile();
  const { orders, loading: ordersLoading } = useAccountOrders();
  const t = useTranslation();
  const toast = useToast();
  const [resendingVerification, setResendingVerification] = useState(false);

  const headerLink = useMemo(
    () => (
      <Link href="/account/profile/edit">
        <Button color="primary">
          {t("account.profile.actions.edit", { defaultMessage: "Edit Profile" })}
        </Button>
      </Link>
    ),
    [t]
  );

  const fullName = profile ? `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() : "";
  const displayName =
    fullName || profile?.email || t("account.profile.fallbackName", { defaultMessage: "Customer" });
  const phoneDisplay = profile?.phone || t("account.profile.phoneMissing", { defaultMessage: "Not provided" });
  const birthDate = profile?.dateOfBirth
    ? format(new Date(profile.dateOfBirth), "dd MMM, yyyy")
    : "—";
  const emailVerificationLabel = profile?.emailVerificationRequired
    ? t("account.profile.emailVerification.pending", {
        defaultMessage: "Pendiente de verificación"
      })
    : t("account.profile.emailVerification.verified", {
        defaultMessage: "Verificado"
      });

  const handleResendVerification = async () => {
    if (!token || !profile?.email || !profile.emailVerificationRequired) {
      return;
    }
    setResendingVerification(true);
    try {
      await StorefrontApi.resendEmailVerification(token);
      toast.success({
        title: t("account.profile.emailVerification.resentTitle", {
          defaultMessage: "Correo reenviado"
        }),
        description: t("account.profile.emailVerification.resentDescription", {
          defaultMessage: "Enviamos un nuevo enlace de verificación a tu correo."
        })
      });
      updateLocalProfile(profile);
    } catch (cause) {
      const message = isApiError(cause)
        ? t(extractApiErrorMessage(cause), { defaultMessage: extractApiErrorMessage(cause) })
        : cause instanceof Error
          ? cause.message
          : t("account.profile.emailVerification.errors.generic", {
              defaultMessage: "No pudimos reenviar el correo de verificación."
            });
      toast.error({
        title: t("account.profile.emailVerification.errors.title", {
          defaultMessage: "No pudimos continuar"
        }),
        description: message
      });
    } finally {
      setResendingVerification(false);
    }
  };

  const infoList = useMemo(() => {
    const totalOrders = orders.length;
    const awaitingPaymentCount = orders.filter((order) => {
      const status = order.paymentStatus?.toLowerCase() ?? "";
      return status === "pending" || status === "awaiting_payment";
    }).length;

    const awaitingShipmentCount = orders.filter((order) => {
      const fulfillment = (order.fulfillmentStatus || order.status || "").toLowerCase();
      return ["processing", "awaiting_shipment", "confirmed"].includes(fulfillment);
    }).length;

    const savedAddresses = profile?.addresses?.length ?? 0;

    return [
      {
        value: totalOrders,
        label: t("account.profile.stats.allOrders", { defaultMessage: "All Orders" }),
        ordersMetric: true
      },
      {
        value: awaitingPaymentCount,
        label: t("account.profile.stats.awaitingPayments", { defaultMessage: "Awaiting Payments" }),
        ordersMetric: true
      },
      {
        value: awaitingShipmentCount,
        label: t("account.profile.stats.awaitingShipment", { defaultMessage: "Awaiting Shipment" }),
        ordersMetric: true
      },
      {
        value: savedAddresses,
        label: t("account.profile.stats.savedAddresses", { defaultMessage: "Saved Addresses" }),
        ordersMetric: false
      }
    ];
  }, [orders, profile?.addresses, t]);

  if (loading && !profile) {
    return (
      <FlexBox minHeight="50vh" alignItems="center" justifyContent="center">
        <Spinner />
      </FlexBox>
    );
  }

  if (error && !profile) {
    return (
      <FlexBox
        flexDirection="column"
        gridGap="0.75rem"
        alignItems="center"
        justifyContent="center"
        minHeight="40vh">
        <Typography color="error.main" fontWeight={600}>
          {error}
        </Typography>
        <Button color="primary" variant="contained" onClick={() => refresh()}>
          {t("Try again")}
        </Button>
      </FlexBox>
    );
  }

  return (
    <Fragment>
      <DashboardPageHeader
        title={t("account.profile.title", { defaultMessage: "My Profile" })}
        button={headerLink}
        Icon={<IconUserFilled size={27} />}
      />

      <Box mb="30px">
        <Grid container spacing={6}>
          <Grid item lg={6} md={6} sm={12} xs={12}>
            <Card
              style={{
                height: "100%",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                boxShadow: "none",
                padding: "14px 32px"
              }}
              border="1px solid"
              borderColor="gray.200">
              <Avatar src={profile?.avatarUrl ?? FALLBACK_AVATAR} size={64} borderRadius={8} />

              <Box ml="12px" flex="1 1 0">
                <FlexBox flexWrap="wrap" justifyContent="space-between" alignItems="center">
                  <div>
                    <H5 my="0px">{displayName}</H5>
                  </div>
                </FlexBox>
              </Box>
            </Card>
          </Grid>

          <Grid item lg={6} md={6} sm={12} xs={12}>
            <Grid container spacing={4}>
              {infoList.map((item) => (
                <Grid item lg={3} sm={6} xs={6} key={item.label}>
                  <Card
                    style={{
                      height: "100%",
                      padding: "1rem 1.25rem",
                      borderRadius: 12,
                      alignItems: "center",
                      flexDirection: "column",
                      justifyContent: "center",
                      textAlign: "center",
                      boxShadow: "none"
                    }}
                    border="1px solid"
                    borderColor="gray.200">
                    <H3 color="primary.main" my="0px" fontWeight="600">
                      {ordersLoading && item.ordersMetric ? "—" : item.value}
                    </H3>

                    <Small color="text.muted" textAlign="center">
                      {item.label}
                    </Small>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Box>

      <TableRow
        p="0.75rem 1.5rem"
        borderRadius={12}
        boxShadow="none"
        border="1px solid"
        borderColor="gray.200">
        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px">
            {t("First name")}
          </Small>

          <span>{profile?.firstName ?? "—"}</span>
        </FlexBox>

        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px">
            {t("Last name")}
          </Small>

          <span>{profile?.lastName ?? "—"}</span>
        </FlexBox>

        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px">
            {t("account.profile.details.status", { defaultMessage: "Estado" })}
          </Small>

          <span>{profile?.status ?? "—"}</span>
        </FlexBox>

        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px">
            {t("account.profile.details.email", { defaultMessage: "Email" })}
          </Small>

          <span>{profile?.email ?? "—"}</span>
          {profile?.email ? (
            <Small
              color={profile.emailVerificationRequired ? "warn.main" : "success.main"}
              mt="0.35rem"
              data-testid="account-email-verification-status">
              {emailVerificationLabel}
            </Small>
          ) : null}
          {profile?.email && profile.emailVerificationRequired ? (
            <Button
              mt="0.5rem"
              size="small"
              variant="outlined"
              color="primary"
              disabled={resendingVerification}
              onClick={handleResendVerification}>
              {resendingVerification
                ? t("account.profile.emailVerification.resending", {
                    defaultMessage: "Reenviando..."
                  })
                : t("account.profile.emailVerification.resend", {
                    defaultMessage: "Reenviar verificación"
                  })}
            </Button>
          ) : null}
        </FlexBox>

        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px" textAlign="left">
            {t("account.profile.details.phone", { defaultMessage: "Phone" })}
          </Small>

          <span>{phoneDisplay}</span>
        </FlexBox>

        <FlexBox flexDirection="column" p="0.5rem">
          <Small color="text.muted" mb="4px">
            {t("account.profile.details.birthDate", { defaultMessage: "Birth date" })}
          </Small>

          <span className="pre">{birthDate}</span>
        </FlexBox>
      </TableRow>
    </Fragment>
  );
}
