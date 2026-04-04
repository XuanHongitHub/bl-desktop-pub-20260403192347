"use client";

import { BadgePercent, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getDefaultCustomPlanOverride,
  readCustomPlanOverride,
  resetCustomPlanOverride,
  subscribeCustomPlanOverride,
  writeCustomPlanOverride,
} from "@/lib/custom-plan-config";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showSuccessToast } from "@/lib/toast-utils";
import type { ControlCoupon } from "@/types";

interface AdminBillingTabProps {
  isPlatformAdmin: boolean;
  isBusy: boolean;
  reason: string;
  setReason: (val: string) => void;
  couponCode: string;
  setCouponCode: (val: string) => void;
  couponSource: "internal" | "stripe";
  setCouponSource: (val: "internal" | "stripe") => void;
  couponDiscount: string;
  setCouponDiscount: (val: string) => void;
  couponMaxRedemptions: string;
  setCouponMaxRedemptions: (val: string) => void;
  couponExpiresAt: string;
  setCouponExpiresAt: (val: string) => void;
  couponAllowlist: string;
  setCouponAllowlist: (val: string) => void;
  couponDenylist: string;
  setCouponDenylist: (val: string) => void;
  handleCreateCoupon: () => void;
  handleRevokeCoupon: (id: string) => void;
  handleSetEntitlement: (
    state: "active" | "grace_active" | "read_only",
  ) => void;
  refreshAdminData: () => void;
  coupons: ControlCoupon[];
}

function formatCouponExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatLocaleDateTime(date);
}

export function AdminBillingTab(props: AdminBillingTabProps) {
  const { t } = useTranslation();
  const [customPlanDraft, setCustomPlanDraft] = useState(
    getDefaultCustomPlanOverride,
  );

  useEffect(() => {
    setCustomPlanDraft(readCustomPlanOverride());
    return subscribeCustomPlanOverride(() => {
      setCustomPlanDraft(readCustomPlanOverride());
    });
  }, []);

  const updateCustomPlanNumber = (
    key: "monthlyPrice" | "yearlyPrice" | "profiles" | "members" | "storageGb",
    value: string,
  ) => {
    const numeric = Number(value);
    setCustomPlanDraft((current) => ({
      ...current,
      [key]:
        Number.isFinite(numeric) && numeric > 0
          ? Math.round(numeric)
          : current[key],
    }));
  };

  const handleSaveCustomPlan = () => {
    writeCustomPlanOverride(customPlanDraft);
    showSuccessToast(t("adminWorkspace.billing.customPlanSaved"));
  };

  const handleResetCustomPlan = () => {
    const defaults = resetCustomPlanOverride();
    setCustomPlanDraft(defaults);
    showSuccessToast(t("adminWorkspace.billing.customPlanReset"));
  };

  if (!props.isPlatformAdmin) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-[13px] text-muted-foreground">
        {t("adminWorkspace.noAccessDescription")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden flex flex-col h-fit">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
            <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-chart-1" />
              {t("adminWorkspace.entitlementControl.title")}
            </CardTitle>
            <CardDescription className="text-[13px]">
              {t("adminWorkspace.entitlementControl.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4 bg-card">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
              <Input
                value={props.reason}
                onChange={(event) => props.setReason(event.target.value)}
                placeholder={t(
                  "adminWorkspace.entitlementControl.reasonPlaceholder",
                )}
                disabled={props.isBusy}
                className="h-10 text-[14px] bg-background"
              />
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-3">
                <Button
                  variant="outline"
                  className="h-9 border-border/70 shadow-sm transition-shadow hover:border-chart-2/40 hover:text-chart-2 hover:shadow-md"
                  onClick={() => props.handleSetEntitlement("active")}
                  disabled={props.isBusy}
                >
                  {t("adminWorkspace.entitlementControl.setActive")}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 border-border/70 shadow-sm transition-shadow hover:border-chart-1/40 hover:text-chart-1 hover:shadow-md"
                  onClick={() => props.handleSetEntitlement("grace_active")}
                  disabled={props.isBusy}
                >
                  {t("adminWorkspace.entitlementControl.setGrace")}
                </Button>
                <Button
                  variant="outline"
                  className="h-9 border-border/70 shadow-sm transition-shadow hover:border-destructive/40 hover:text-destructive hover:shadow-md"
                  onClick={() => props.handleSetEntitlement("read_only")}
                  disabled={props.isBusy}
                >
                  {t("adminWorkspace.entitlementControl.setReadOnly")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/30 border-b border-border/50 pb-4 flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-[15px] font-semibold flex items-center gap-2">
                <BadgePercent className="h-4 w-4 text-chart-4" />
                {t("adminWorkspace.billing.couponTitle")}
              </CardTitle>
              <CardDescription className="text-[13px]">
                {t("adminWorkspace.billing.couponDescription")}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shadow-sm hover:shadow-md transition-shadow border-border/50 bg-background"
              onClick={props.refreshAdminData}
              disabled={props.isBusy}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              {t("adminWorkspace.controlPlane.refresh")}
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6 bg-card">
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <h4 className="text-[13px] font-medium text-foreground mb-3">
                {t("adminWorkspace.billing.createCoupon")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <Input
                  value={props.couponCode}
                  onChange={(event) =>
                    props.setCouponCode(event.target.value.toUpperCase())
                  }
                  placeholder={t("adminWorkspace.billing.couponCode")}
                  disabled={props.isBusy}
                  className="h-10 text-[14px] bg-background md:col-span-2"
                />
                <Select
                  value={props.couponSource}
                  onValueChange={(value) =>
                    props.setCouponSource(value as "internal" | "stripe")
                  }
                  disabled={props.isBusy}
                >
                  <SelectTrigger className="h-10 text-[14px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">
                      {t("adminWorkspace.billing.sourceInternal")}
                    </SelectItem>
                    <SelectItem value="stripe">
                      {t("adminWorkspace.billing.sourceStripe")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={props.couponDiscount}
                  onChange={(event) =>
                    props.setCouponDiscount(event.target.value)
                  }
                  placeholder={t("adminWorkspace.billing.couponDiscount")}
                  disabled={props.isBusy}
                  type="number"
                  className="h-10 text-[14px] bg-background"
                />
                <Input
                  value={props.couponMaxRedemptions}
                  onChange={(event) =>
                    props.setCouponMaxRedemptions(event.target.value)
                  }
                  placeholder={t("adminWorkspace.billing.couponMax")}
                  disabled={props.isBusy}
                  type="number"
                  className="h-10 text-[14px] bg-background md:col-span-2"
                />
                <Input
                  value={props.couponExpiresAt}
                  onChange={(event) =>
                    props.setCouponExpiresAt(event.target.value)
                  }
                  disabled={props.isBusy}
                  type="datetime-local"
                  className="h-10 text-[14px] bg-background md:col-span-2"
                />
                <Input
                  value={props.couponAllowlist}
                  onChange={(event) =>
                    props.setCouponAllowlist(event.target.value)
                  }
                  placeholder={t("adminWorkspace.billing.couponAllowlist")}
                  disabled={props.isBusy}
                  className="h-10 text-[14px] bg-background md:col-span-2"
                />
                <Input
                  value={props.couponDenylist}
                  onChange={(event) =>
                    props.setCouponDenylist(event.target.value)
                  }
                  placeholder={t("adminWorkspace.billing.couponDenylist")}
                  disabled={props.isBusy}
                  className="h-10 text-[14px] bg-background md:col-span-2"
                />
                <Button
                  onClick={props.handleCreateCoupon}
                  disabled={props.isBusy}
                  className="h-10 md:col-span-4 w-full"
                >
                  {t("adminWorkspace.billing.createCoupon")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="px-1 text-[13px] font-medium text-foreground">
                {t("adminWorkspace.billing.generatedCoupons")}
              </p>
              <ScrollArea className="h-[320px] rounded-md border border-border/70">
                <Table className="min-w-[720px] overflow-visible">
                  <TableHeader className="overflow-visible">
                    <TableRow className="overflow-visible">
                      <TableHead className="text-[12px] text-muted-foreground">
                        {t("adminWorkspace.billing.couponCode")}
                      </TableHead>
                      <TableHead className="text-[12px] text-muted-foreground">
                        {t("adminWorkspace.columns.source")}
                      </TableHead>
                      <TableHead className="text-[12px] text-muted-foreground">
                        {t("adminWorkspace.columns.status")}
                      </TableHead>
                      <TableHead className="text-[12px] text-muted-foreground">
                        {t("adminWorkspace.columns.usage")}
                      </TableHead>
                      <TableHead className="text-[12px] text-muted-foreground">
                        {t("adminWorkspace.ui.expiry")}
                      </TableHead>
                      <TableHead className="text-[12px] text-muted-foreground text-right">
                        {t("adminWorkspace.columns.action")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="overflow-visible">
                    {props.coupons.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-[13px] text-center py-6 text-muted-foreground"
                        >
                          {t("adminWorkspace.billing.noCoupons")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      props.coupons.map((coupon) => (
                        <TableRow
                          key={coupon.id}
                          className="hover:bg-accent/50"
                        >
                          <TableCell className="text-[13px] font-mono font-bold text-foreground">
                            <Badge variant="outline">{coupon.code}</Badge>
                          </TableCell>
                          <TableCell className="text-[13px]">
                            {coupon.source === "internal"
                              ? t("adminWorkspace.billing.sourceInternal")
                              : t("adminWorkspace.billing.sourceStripe")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={coupon.revokedAt ? "warning" : "success"}
                              className="text-[11px] font-medium"
                            >
                              {coupon.revokedAt
                                ? t("adminWorkspace.billing.revokedStatus")
                                : t("adminWorkspace.billing.activeStatus")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground font-mono">
                            <span className="text-foreground">
                              {coupon.redeemedCount}
                            </span>{" "}
                            /{" "}
                            {coupon.maxRedemptions === 0
                              ? "∞"
                              : coupon.maxRedemptions}
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground">
                            {formatCouponExpiry(coupon.expiresAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            {!coupon.revokedAt && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5"
                                onClick={() =>
                                  props.handleRevokeCoupon(coupon.id)
                                }
                                disabled={props.isBusy}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-[15px] font-semibold">
            {t("adminWorkspace.billing.customPlanTitle")}
          </CardTitle>
          <CardDescription className="text-[13px]">
            {t("adminWorkspace.billing.customPlanDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4 bg-card">
          <Tabs defaultValue="pricing" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pricing" className="text-[12px]">
                {t("adminWorkspace.billing.planMenuPricing")}
              </TabsTrigger>
              <TabsTrigger value="usage" className="text-[12px]">
                {t("adminWorkspace.billing.planMenuUsage")}
              </TabsTrigger>
              <TabsTrigger value="experience" className="text-[12px]">
                {t("adminWorkspace.billing.planMenuExperience")}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="pricing"
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanEnabled")}
                </Label>
                <Select
                  value={customPlanDraft.enabled ? "enabled" : "disabled"}
                  onValueChange={(value) =>
                    setCustomPlanDraft((current) => ({
                      ...current,
                      enabled: value === "enabled",
                    }))
                  }
                  disabled={props.isBusy}
                >
                  <SelectTrigger className="h-10 text-[13px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enabled">
                      {t("adminWorkspace.billing.customPlanEnabledYes")}
                    </SelectItem>
                    <SelectItem value="disabled">
                      {t("adminWorkspace.billing.customPlanEnabledNo")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanMonthly")}
                </Label>
                <Input
                  value={customPlanDraft.monthlyPrice}
                  onChange={(event) =>
                    updateCustomPlanNumber("monthlyPrice", event.target.value)
                  }
                  type="number"
                  min={1}
                  className="h-10 text-[13px] bg-background"
                  disabled={props.isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanYearly")}
                </Label>
                <Input
                  value={customPlanDraft.yearlyPrice}
                  onChange={(event) =>
                    updateCustomPlanNumber("yearlyPrice", event.target.value)
                  }
                  type="number"
                  min={1}
                  className="h-10 text-[13px] bg-background"
                  disabled={props.isBusy}
                />
              </div>
            </TabsContent>

            <TabsContent value="usage" className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanProfiles")}
                </Label>
                <Input
                  value={customPlanDraft.profiles}
                  onChange={(event) =>
                    updateCustomPlanNumber("profiles", event.target.value)
                  }
                  type="number"
                  min={1}
                  className="h-10 text-[13px] bg-background"
                  disabled={props.isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanMembers")}
                </Label>
                <Input
                  value={customPlanDraft.members}
                  onChange={(event) =>
                    updateCustomPlanNumber("members", event.target.value)
                  }
                  type="number"
                  min={1}
                  className="h-10 text-[13px] bg-background"
                  disabled={props.isBusy}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanStorage")}
                </Label>
                <Input
                  value={customPlanDraft.storageGb}
                  onChange={(event) =>
                    updateCustomPlanNumber("storageGb", event.target.value)
                  }
                  type="number"
                  min={1}
                  className="h-10 text-[13px] bg-background"
                  disabled={props.isBusy}
                />
              </div>
            </TabsContent>

            <TabsContent
              value="experience"
              className="grid gap-3 md:grid-cols-2"
            >
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanSupport")}
                </Label>
                <Select
                  value={customPlanDraft.support}
                  onValueChange={(value) =>
                    setCustomPlanDraft((current) => ({
                      ...current,
                      support: value as "email" | "priority" | "dedicated",
                    }))
                  }
                  disabled={props.isBusy}
                >
                  <SelectTrigger className="h-10 text-[13px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      {t("authLanding.support.email")}
                    </SelectItem>
                    <SelectItem value="priority">
                      {t("authLanding.support.priority")}
                    </SelectItem>
                    <SelectItem value="dedicated">
                      {t("authLanding.support.dedicated")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.billing.customPlanRecommended")}
                </Label>
                <Select
                  value={customPlanDraft.recommended ? "yes" : "no"}
                  onValueChange={(value) =>
                    setCustomPlanDraft((current) => ({
                      ...current,
                      recommended: value === "yes",
                    }))
                  }
                  disabled={props.isBusy}
                >
                  <SelectTrigger className="h-10 text-[13px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">
                      {t("adminWorkspace.billing.customPlanRecommendedYes")}
                    </SelectItem>
                    <SelectItem value="no">
                      {t("adminWorkspace.billing.customPlanRecommendedNo")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleResetCustomPlan}
              disabled={props.isBusy}
            >
              {t("adminWorkspace.billing.customPlanResetAction")}
            </Button>
            <Button onClick={handleSaveCustomPlan} disabled={props.isBusy}>
              {t("adminWorkspace.billing.customPlanSaveAction")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
