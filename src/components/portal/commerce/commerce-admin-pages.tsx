"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  activateCommerceCampaign,
  createCommerceCampaign,
  createCommerceCoupon,
  createCommerceLicense,
  createCommercePlan,
  deactivateCommerceCampaign,
  disableCommerceCoupon,
  listCommerceAudit,
  listCommerceCampaigns,
  listCommerceCoupons,
  listCommerceLicenses,
  listCommercePlans,
  previewCommercePrice,
  publishCommercePlanVersion,
  revokeCommerceLicense,
  rotateCommerceLicense,
  type CommercePricePreviewInput,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  CommerceAuditEvent,
  CommerceCampaign,
  CommerceCoupon,
  CommerceLicenseKey,
  CommercePlan,
  CommercePricePreviewResult,
} from "@/types";

type CommerceKind =
  | "plans"
  | "campaigns"
  | "coupons"
  | "licenses"
  | "preview"
  | "audit";

function buildErrorDescription(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function AdminCommercePlansPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [plans, setPlans] = useState<CommercePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    code: "",
    name: "",
    monthlyPriceUsd: "29",
    yearlyPriceUsd: "29",
    profiles: "100",
    members: "2",
    storageGb: "10",
    proxyGb: "2",
    supportTier: "email" as "email" | "priority" | "dedicated",
  });

  const refresh = useCallback(async () => {
    if (!connection) {
      setPlans([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listCommercePlans(connection);
      setPlans(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.loadFailed"), {
        description: buildErrorDescription(error, "load_plans_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return plans;
    }
    return plans.filter((item) =>
      [item.code, item.name, item.status].join(" ").toLowerCase().includes(keyword),
    );
  }, [plans, query]);

  const handleCreate = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!draft.code.trim() || !draft.name.trim()) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    setCreating(true);
    try {
      await createCommercePlan(connection, {
        code: draft.code.trim().toLowerCase(),
        name: draft.name.trim(),
        monthlyPriceUsd: Number(draft.monthlyPriceUsd),
        yearlyPriceUsd: Number(draft.yearlyPriceUsd),
        profiles: Number(draft.profiles),
        members: Number(draft.members),
        storageGb: Number(draft.storageGb),
        proxyGb: Number(draft.proxyGb),
        supportTier: draft.supportTier,
      });
      showSuccessToast(t("portalSite.commerce.toasts.planCreated"));
      setDraft((current) => ({ ...current, code: "", name: "" }));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.createFailed"), {
        description: buildErrorDescription(error, "create_plan_failed"),
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (planId: string) => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    try {
      await publishCommercePlanVersion(connection, planId);
      showSuccessToast(t("portalSite.commerce.toasts.planPublished"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "publish_plan_failed"),
      });
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.plans.title")}
      description={t("portalSite.commerce.plans.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.commerce.actions.refresh")}
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input
            value={draft.code}
            onChange={(event) =>
              setDraft((current) => ({ ...current, code: event.target.value }))
            }
            placeholder={t("portalSite.commerce.fields.planCode")}
            className="h-9"
          />
          <Input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder={t("portalSite.commerce.fields.planName")}
            className="h-9"
          />
          <Input
            value={draft.monthlyPriceUsd}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                monthlyPriceUsd: event.target.value,
              }))
            }
            placeholder={t("portalSite.commerce.fields.monthlyPrice")}
            className="h-9"
            type="number"
          />
          <Input
            value={draft.yearlyPriceUsd}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                yearlyPriceUsd: event.target.value,
              }))
            }
            placeholder={t("portalSite.commerce.fields.yearlyPrice")}
            className="h-9"
            type="number"
          />
          <Select
            value={draft.supportTier}
            onValueChange={(value) =>
              setDraft((current) => ({
                ...current,
                supportTier: value as "email" | "priority" | "dedicated",
              }))
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">
                {t("portalSite.commerce.support.email")}
              </SelectItem>
              <SelectItem value="priority">
                {t("portalSite.commerce.support.priority")}
              </SelectItem>
              <SelectItem value="dedicated">
                {t("portalSite.commerce.support.dedicated")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => void handleCreate()} disabled={creating || loading}>
            {t("portalSite.commerce.actions.createPlan")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.commerce.search")}
            className="h-9 w-full max-w-sm"
          />
          <Badge variant="outline" className="ml-auto">
            {filtered.length}
          </Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.plan")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.price")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.limits")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.code} · v{item.version}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      ${item.monthlyPriceUsd} / ${item.yearlyPriceUsd}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.profiles} {t("portalSite.commerce.columns.profiles")} · {item.members} {t("portalSite.commerce.columns.members")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{item.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => void handlePublish(item.id)}>
                        {t("portalSite.commerce.actions.publish")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}

export function AdminCommerceCampaignsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [campaigns, setCampaigns] = useState<CommerceCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [priority, setPriority] = useState("10");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setCampaigns([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listCommerceCampaigns(connection);
      setCampaigns(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.loadFailed"), {
        description: buildErrorDescription(error, "load_campaigns_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!name.trim() || !startsAt || !endsAt) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    try {
      await createCommerceCampaign(connection, {
        name: name.trim(),
        discountPercent: Number(discountPercent),
        priority: Number(priority),
        exclusive: false,
        startsAt,
        endsAt,
      });
      showSuccessToast(t("portalSite.commerce.toasts.campaignCreated"));
      setName("");
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.createFailed"), {
        description: buildErrorDescription(error, "create_campaign_failed"),
      });
    }
  };

  const handleToggle = async (item: CommerceCampaign) => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    try {
      if (item.status === "running") {
        await deactivateCommerceCampaign(connection, item.id);
      } else {
        await activateCommerceCampaign(connection, item.id);
      }
      showSuccessToast(t("portalSite.commerce.toasts.actionDone"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "toggle_campaign_failed"),
      });
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.campaigns.title")}
      description={t("portalSite.commerce.campaigns.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("portalSite.commerce.fields.campaignName")}
            className="h-9 md:col-span-2"
          />
          <Input
            value={discountPercent}
            onChange={(event) => setDiscountPercent(event.target.value)}
            type="number"
            className="h-9"
            placeholder={t("portalSite.commerce.fields.discountPercent")}
          />
          <Input
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            type="number"
            className="h-9"
            placeholder={t("portalSite.commerce.fields.priority")}
          />
          <Button onClick={() => void handleCreate()}>
            {t("portalSite.commerce.actions.createCampaign")}
          </Button>
          <Input
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            type="datetime-local"
            className="h-9"
          />
          <Input
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            type="datetime-local"
            className="h-9"
          />
          <Button variant="outline" onClick={() => void refresh()}>
            {t("portalSite.commerce.actions.refresh")}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.campaign")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.window")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.loading")}
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.empty")}
                  </td>
                </tr>
              ) : (
                campaigns.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.discountPercent}% · P{item.priority}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatLocaleDateTime(item.startsAt)} → {formatLocaleDateTime(item.endsAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{item.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => void handleToggle(item)}>
                        {item.status === "running"
                          ? t("portalSite.commerce.actions.pause")
                          : t("portalSite.commerce.actions.activate")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}

export function AdminCommerceCouponsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [coupons, setCoupons] = useState<CommerceCoupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("20");
  const [maxRedemptions, setMaxRedemptions] = useState("100");
  const [maxPerUser, setMaxPerUser] = useState("1");
  const [maxPerWorkspace, setMaxPerWorkspace] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setCoupons([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listCommerceCoupons(connection);
      setCoupons(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.loadFailed"), {
        description: buildErrorDescription(error, "load_coupons_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!code.trim() || !expiresAt) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    try {
      await createCommerceCoupon(connection, {
        code: code.trim().toUpperCase(),
        discountPercent: Number(discountPercent),
        maxRedemptions: Number(maxRedemptions),
        maxPerUser: Number(maxPerUser),
        maxPerWorkspace: Number(maxPerWorkspace),
        expiresAt,
      });
      showSuccessToast(t("portalSite.commerce.toasts.couponCreated"));
      setCode("");
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.createFailed"), {
        description: buildErrorDescription(error, "create_coupon_failed"),
      });
    }
  };

  const handleDisable = async (couponId: string) => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    try {
      await disableCommerceCoupon(connection, couponId);
      showSuccessToast(t("portalSite.commerce.toasts.actionDone"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "disable_coupon_failed"),
      });
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.coupons.title")}
      description={t("portalSite.commerce.coupons.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Input value={code} onChange={(event) => setCode(event.target.value)} className="h-9" placeholder={t("portalSite.commerce.fields.couponCode")} />
          <Input value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.discountPercent")} />
          <Input value={maxRedemptions} onChange={(event) => setMaxRedemptions(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.maxRedemptions")} />
          <Input value={maxPerUser} onChange={(event) => setMaxPerUser(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.maxPerUser")} />
          <Input value={maxPerWorkspace} onChange={(event) => setMaxPerWorkspace(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.maxPerWorkspace")} />
          <Input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" className="h-9" />
          <Button onClick={() => void handleCreate()}>{t("portalSite.commerce.actions.createCoupon")}</Button>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.coupon")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.usage")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("portalSite.commerce.loading")}</td>
                </tr>
              ) : coupons.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("portalSite.commerce.empty")}</td>
                </tr>
              ) : (
                coupons.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{item.code}</p>
                      <p className="text-xs text-muted-foreground">{item.discountPercent}%</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.redeemedCount} / {item.maxRedemptions}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{item.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => void handleDisable(item.id)}>
                        {t("portalSite.commerce.actions.disable")}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}

export function AdminCommerceLicensesPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [licenses, setLicenses] = useState<CommerceLicenseKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [planCode, setPlanCode] = useState("starter");
  const [seats, setSeats] = useState("1");
  const [profileQuota, setProfileQuota] = useState("50");
  const [expiresAt, setExpiresAt] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setLicenses([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listCommerceLicenses(connection);
      setLicenses(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.loadFailed"), {
        description: buildErrorDescription(error, "load_licenses_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    try {
      await createCommerceLicense(connection, {
        planCode,
        seats: Number(seats),
        profileQuota: Number(profileQuota),
        expiresAt: expiresAt || null,
      });
      showSuccessToast(t("portalSite.commerce.toasts.licenseCreated"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.createFailed"), {
        description: buildErrorDescription(error, "create_license_failed"),
      });
    }
  };

  const handleAction = async (
    item: CommerceLicenseKey,
    action: "revoke" | "rotate",
  ) => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    try {
      if (action === "revoke") {
        await revokeCommerceLicense(connection, item.id);
      } else {
        await rotateCommerceLicense(connection, item.id);
      }
      showSuccessToast(t("portalSite.commerce.toasts.actionDone"));
      await refresh();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "license_action_failed"),
      });
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.licenses.title")}
      description={t("portalSite.commerce.licenses.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input value={planCode} onChange={(event) => setPlanCode(event.target.value)} className="h-9" placeholder={t("portalSite.commerce.fields.planCode")} />
          <Input value={seats} onChange={(event) => setSeats(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.seats")} />
          <Input value={profileQuota} onChange={(event) => setProfileQuota(event.target.value)} type="number" className="h-9" placeholder={t("portalSite.commerce.fields.profileQuota")} />
          <Input value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} type="datetime-local" className="h-9" />
          <Button onClick={() => void handleCreate()}>{t("portalSite.commerce.actions.createLicense")}</Button>
        </div>
      </section>
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.license")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.binding")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.action")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("portalSite.commerce.loading")}</td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">{t("portalSite.commerce.empty")}</td>
                </tr>
              ) : (
                licenses.map((item) => (
                  <tr key={item.id} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{item.keyMasked}</p>
                      <p className="text-xs text-muted-foreground">{item.planCode} · {item.seats}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.workspaceId ?? "--"} / {item.userId ?? "--"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{item.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => void handleAction(item, "rotate")}>
                          {t("portalSite.commerce.actions.rotate")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleAction(item, "revoke")}>
                          {t("portalSite.commerce.actions.revoke")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}

export function AdminCommercePreviewPage() {
  const { t } = useTranslation();
  const { connection, selectedWorkspaceId } = usePortalBillingData();
  const [input, setInput] = useState<CommercePricePreviewInput>({
    workspaceId: selectedWorkspaceId,
    planCode: "starter",
    interval: "monthly",
    campaignId: null,
    couponCode: null,
  });
  const [result, setResult] = useState<CommercePricePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInput((current) => ({
      ...current,
      workspaceId: selectedWorkspaceId,
    }));
  }, [selectedWorkspaceId]);

  const handlePreview = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!input.workspaceId.trim() || !input.planCode.trim()) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    setLoading(true);
    try {
      const payload = await previewCommercePrice(connection, input);
      setResult(payload);
      showSuccessToast(t("portalSite.commerce.toasts.previewReady"));
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "preview_failed"),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.preview.title")}
      description={t("portalSite.commerce.preview.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1">
            <Label>{t("portalSite.commerce.fields.workspaceId")}</Label>
            <Input
              value={input.workspaceId}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  workspaceId: event.target.value,
                }))
              }
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("portalSite.commerce.fields.planCode")}</Label>
            <Input
              value={input.planCode}
              onChange={(event) =>
                setInput((current) => ({ ...current, planCode: event.target.value }))
              }
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("portalSite.commerce.fields.interval")}</Label>
            <Select
              value={input.interval}
              onValueChange={(value) =>
                setInput((current) => ({
                  ...current,
                  interval: value as "monthly" | "yearly",
                }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">{t("portalSite.checkout.cycleMonthly")}</SelectItem>
                <SelectItem value="yearly">{t("portalSite.checkout.cycleYearly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("portalSite.commerce.fields.campaignId")}</Label>
            <Input
              value={input.campaignId ?? ""}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  campaignId: event.target.value || null,
                }))
              }
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label>{t("portalSite.commerce.fields.couponCode")}</Label>
            <Input
              value={input.couponCode ?? ""}
              onChange={(event) =>
                setInput((current) => ({
                  ...current,
                  couponCode: event.target.value || null,
                }))
              }
              className="h-9"
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => void handlePreview()} disabled={loading}>
              {t("portalSite.commerce.actions.runPreview")}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        {result == null ? (
          <p className="text-sm text-muted-foreground">{t("portalSite.commerce.preview.empty")}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{result.planCode}</Badge>
              <Badge variant="outline">{result.interval}</Badge>
              <Badge variant="outline">{result.workspaceId}</Badge>
              <Badge variant="secondary" className="ml-auto">
                ${formatLocaleNumber(result.finalAmountUsd, { maximumFractionDigits: 2 })}
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.line")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((line) => (
                    <tr key={line.code} className="border-t border-border/70">
                      <td className="px-3 py-2 text-foreground">{line.label}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        ${formatLocaleNumber(line.amountUsd, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </PortalSettingsPage>
  );
}

export function AdminCommerceAuditPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [events, setEvents] = useState<CommerceAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState("50");

  const refresh = useCallback(async () => {
    if (!connection) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listCommerceAudit(connection, Number(limit));
      setEvents(Array.isArray(payload) ? payload : []);
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.loadFailed"), {
        description: buildErrorDescription(error, "load_audit_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, limit, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.commerce.eyebrow")}
      title={t("portalSite.commerce.audit.title")}
      description={t("portalSite.commerce.audit.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Input
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            type="number"
            className="h-9 w-[120px]"
          />
          <Button variant="outline" onClick={() => void refresh()}>
            {t("portalSite.commerce.actions.refresh")}
          </Button>
          <Badge variant="outline" className="ml-auto">
            {events.length}
          </Badge>
        </div>
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.entity")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.action")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.actor")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.commerce.columns.time")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.loading")}
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.commerce.empty")}
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-foreground">{event.entityType}:{event.entityId}</td>
                    <td className="px-3 py-2 text-muted-foreground">{event.action}</td>
                    <td className="px-3 py-2 text-muted-foreground">{event.actorUserId}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatLocaleDateTime(event.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}

