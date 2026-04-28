"use client";

import { useMemo, useState } from "react";

import Box from "@component/Box";
import Container from "@component/Container";
import FlexBox from "@component/FlexBox";
import Grid from "@component/grid/Grid";
import Stepper from "@component/Stepper";
import Typography, { H1, Paragraph } from "@component/Typography";
import TextField from "@component/text-field";
import TextArea from "@component/textarea";
import { Button } from "@component/buttons";
import { Card1 } from "@component/Card1";

import BudgetCalculatorPanel from "@/components/budget/BudgetCalculatorPanel";
import { useStorefrontConfig } from "@/app/(storefront)/storefront-context";
import { StorefrontApi } from "@/lib/api/storefront";
import { executeRecaptchaAction } from "@/utils/security/recaptcha";

type Props = {
  title: string;
  description: string;
  initialProductId?: number | null;
  initialProductSlug?: string | null;
  initialWidth?: number;
  initialHeight?: number;
};

const stepperItems = [
  { title: "Tus datos", disabled: false },
  { title: "Tu presupuesto", disabled: true },
];

export default function BudgetPageContent({
  title,
  description,
  initialProductId,
  initialProductSlug,
  initialWidth = 1,
  initialHeight = 1,
}: Props) {
  const config = useStorefrontConfig();
  const [currentStep, setCurrentStep] = useState(1);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadNotes, setLeadNotes] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

  const recaptchaSiteKey =
    config.integrations?.recaptcha?.enabled && config.integrations.recaptcha.siteKey
      ? config.integrations.recaptcha.siteKey
      : null;

  const canProceed = useMemo(() => {
    const name = leadName.trim();
    const email = leadEmail.trim();
    const phone = leadPhone.trim();
    return Boolean(name.length && (email.length > 0 || phone.length > 0));
  }, [leadEmail, leadName, leadPhone]);

  const handleLeadSubmit = async () => {
    const name = leadName.trim();
    const email = leadEmail.trim();
    const phone = leadPhone.trim();

    if (!name) {
      setLeadError("Ingresá tu nombre para continuar.");
      return;
    }
    if (!email && !phone) {
      setLeadError("Dejanos al menos un medio de contacto para poder responderte.");
      return;
    }

    setLeadLoading(true);
    setLeadError(null);

    try {
      const recaptchaToken = recaptchaSiteKey
        ? await executeRecaptchaAction(recaptchaSiteKey, "budget_lead")
        : null;

      await StorefrontApi.saveBudgetLead({
        name,
        email: email || undefined,
        phone: phone || undefined,
        recaptchaToken: recaptchaToken ?? undefined,
      });

      setLeadSaved(true);
      setCurrentStep(2);
    } catch (error) {
      setLeadError(error instanceof Error ? error.message : "No pudimos guardar tus datos. Intentá de nuevo.");
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <Box>
      <Box
        style={{
          background: "linear-gradient(180deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0) 100%)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}>
        <Container>
          <Box style={{ padding: "40px 0 24px" }}>
            <Typography fontSize="12px" color="gray.500" fontWeight="600">
              Presupuesto online
            </Typography>
            <H1 mt="8px">{title}</H1>
            <Paragraph mt="12px" color="gray.600" maxWidth="760px">
              {description}
            </Paragraph>
          </Box>
        </Container>
      </Box>

      <Container>
        <Box style={{ padding: "24px 0 56px" }}>
          <Card1 borderRadius={16} mb="24px">
            <Stepper
              selectedStep={currentStep}
              stepperList={stepperItems.map((step, index) => ({
                ...step,
                disabled: index === 1 ? !leadSaved : step.disabled,
              }))}
              onChange={(_, index) => {
                if (index === 0 || leadSaved) {
                  setCurrentStep(index + 1);
                }
              }}
            />
          </Card1>

          {currentStep === 1 ? (
            <Card1 borderRadius={16}>
              <FlexBox justifyContent="space-between" alignItems="center" mb="1rem">
                <H1 fontSize="28px" mb="0">
                  Antes de calcular
                </H1>
                <Typography fontSize="12px" color="gray.600">
                  Guardamos tus datos para continuar
                </Typography>
              </FlexBox>

              <Paragraph color="gray.600" maxWidth="760px">
                Necesitamos tu nombre y al menos un contacto para poder enviarte el presupuesto y hacer el seguimiento correspondiente.
              </Paragraph>

              <Grid container spacing={6} mt="1rem">
                <Grid item md={6} xs={12}>
                  <TextField
                    id="budget-lead-name"
                    label="Nombre"
                    value={leadName}
                    onChange={(event) => setLeadName(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item md={6} xs={12}>
                  <TextField
                    id="budget-lead-email"
                    label="Correo electrónico"
                    type="email"
                    value={leadEmail}
                    onChange={(event) => setLeadEmail(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item md={6} xs={12}>
                  <TextField
                    id="budget-lead-phone"
                    label="WhatsApp"
                    value={leadPhone}
                    onChange={(event) => setLeadPhone(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextArea
                    id="budget-lead-notes"
                    label="Comentario opcional"
                    rows={4}
                    value={leadNotes}
                    onChange={(event) => setLeadNotes(event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>

              {leadError ? (
                <Box mt="12px">
                  <Paragraph color="error.main">{leadError}</Paragraph>
                </Box>
              ) : null}

              <FlexBox justifyContent="flex-end" mt="1.5rem">
                <Button variant="contained" color="primary" onClick={handleLeadSubmit} disabled={!canProceed || leadLoading}>
                  {leadLoading ? "Guardando..." : "Continuar al presupuesto"}
                </Button>
              </FlexBox>
            </Card1>
          ) : (
            <Box>
              <BudgetCalculatorPanel
                compact
                title={title}
                description="Elegí un producto, completá tus medidas y armá tu presupuesto en minutos."
                initialProductId={initialProductId}
                initialProductSlug={initialProductSlug}
                initialWidth={initialWidth}
                initialHeight={initialHeight}
                initialCustomerName={leadName}
                initialCustomerEmail={leadEmail}
                initialCustomerPhone={leadPhone}
                initialCustomerNotes={leadNotes}
                showCustomerFields={false}
                submitLabel="Agregar al carrito"
                onEditCustomer={() => setCurrentStep(1)}
              />
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
