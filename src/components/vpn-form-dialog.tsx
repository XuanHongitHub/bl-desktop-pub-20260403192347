"use client";

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LoadingButton } from "@/components/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RippleButton } from "@/components/ui/ripple";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { VpnConfig, VpnType } from "@/types";

interface VpnFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingVpn?: VpnConfig | null;
}

interface WireGuardFormData {
  name: string;
  privateKey: string;
  address: string;
  dns: string;
  mtu: string;
  peerPublicKey: string;
  peerEndpoint: string;
  allowedIps: string;
  persistentKeepalive: string;
  presharedKey: string;
}

interface OpenVpnFormData {
  name: string;
  rawConfig: string;
}

const defaultWireGuardForm: WireGuardFormData = {
  name: "",
  privateKey: "",
  address: "",
  dns: "",
  mtu: "",
  peerPublicKey: "",
  peerEndpoint: "",
  allowedIps: "0.0.0.0/0, ::/0",
  persistentKeepalive: "",
  presharedKey: "",
};

const defaultOpenVpnForm: OpenVpnFormData = {
  name: "",
  rawConfig: "",
};

function buildWireGuardConfig(form: WireGuardFormData): string {
  const lines: string[] = ["[Interface]"];
  lines.push(`PrivateKey = ${form.privateKey.trim()}`);
  lines.push(`Address = ${form.address.trim()}`);
  if (form.dns.trim()) lines.push(`DNS = ${form.dns.trim()}`);
  if (form.mtu.trim()) lines.push(`MTU = ${form.mtu.trim()}`);
  lines.push("");
  lines.push("[Peer]");
  lines.push(`PublicKey = ${form.peerPublicKey.trim()}`);
  lines.push(`Endpoint = ${form.peerEndpoint.trim()}`);
  lines.push(`AllowedIPs = ${form.allowedIps.trim()}`);
  if (form.persistentKeepalive.trim())
    lines.push(`PersistentKeepalive = ${form.persistentKeepalive.trim()}`);
  if (form.presharedKey.trim())
    lines.push(`PresharedKey = ${form.presharedKey.trim()}`);
  return lines.join("\n");
}

export function VpnFormDialog({
  isOpen,
  onClose,
  editingVpn,
}: VpnFormDialogProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vpnType, setVpnType] = useState<VpnType>("WireGuard");
  const [wireGuardForm, setWireGuardForm] =
    useState<WireGuardFormData>(defaultWireGuardForm);
  const [openVpnForm, setOpenVpnForm] =
    useState<OpenVpnFormData>(defaultOpenVpnForm);

  const resetForms = useCallback(() => {
    setVpnType("WireGuard");
    setWireGuardForm(defaultWireGuardForm);
    setOpenVpnForm(defaultOpenVpnForm);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (editingVpn) {
        setVpnType(editingVpn.vpn_type);
        if (editingVpn.vpn_type === "WireGuard") {
          setWireGuardForm({ ...defaultWireGuardForm, name: editingVpn.name });
        } else {
          setOpenVpnForm({ name: editingVpn.name, rawConfig: "" });
        }
      } else {
        resetForms();
      }
    }
  }, [isOpen, editingVpn, resetForms]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (editingVpn) {
      const name =
        vpnType === "WireGuard"
          ? wireGuardForm.name.trim()
          : openVpnForm.name.trim();

      if (!name) {
        toast.error(t("vpnForm.errors.nameRequired"));
        return;
      }

      setIsSubmitting(true);
      try {
        await invoke("update_vpn_config", {
          vpnId: editingVpn.id,
          name,
        });
        await emit("vpn-configs-changed");
        toast.success(t("vpnForm.toasts.updated"));
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(
          t("vpnForm.errors.updateFailed", { message: errorMessage }),
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (vpnType === "WireGuard") {
      const { name, privateKey, address, peerPublicKey, peerEndpoint } =
        wireGuardForm;

      if (!name.trim()) {
        toast.error(t("vpnForm.errors.nameRequired"));
        return;
      }
      if (!privateKey.trim()) {
        toast.error(t("vpnForm.errors.privateKeyRequired"));
        return;
      }
      if (!address.trim()) {
        toast.error(t("vpnForm.errors.addressRequired"));
        return;
      }
      if (!peerPublicKey.trim()) {
        toast.error(t("vpnForm.errors.peerPublicKeyRequired"));
        return;
      }
      if (!peerEndpoint.trim()) {
        toast.error(t("vpnForm.errors.peerEndpointRequired"));
        return;
      }

      setIsSubmitting(true);
      try {
        const configData = buildWireGuardConfig(wireGuardForm);
        await invoke("create_vpn_config_manual", {
          name: name.trim(),
          vpnType: "WireGuard",
          configData,
        });
        await emit("vpn-configs-changed");
        toast.success(t("vpnForm.toasts.wireguardCreated"));
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(
          t("vpnForm.errors.createFailed", { message: errorMessage }),
        );
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const { name, rawConfig } = openVpnForm;

      if (!name.trim()) {
        toast.error(t("vpnForm.errors.nameRequired"));
        return;
      }
      if (!rawConfig.trim()) {
        toast.error(t("vpnForm.errors.openVpnConfigRequired"));
        return;
      }

      setIsSubmitting(true);
      try {
        await invoke("create_vpn_config_manual", {
          name: name.trim(),
          vpnType: "OpenVPN",
          configData: rawConfig,
        });
        await emit("vpn-configs-changed");
        toast.success(t("vpnForm.toasts.openVpnCreated"));
        onClose();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        toast.error(
          t("vpnForm.errors.createFailed", { message: errorMessage }),
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [editingVpn, onClose, openVpnForm, t, vpnType, wireGuardForm]);

  const updateWireGuard = useCallback(
    (field: keyof WireGuardFormData, value: string) => {
      setWireGuardForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const updateOpenVpn = useCallback(
    (field: keyof OpenVpnFormData, value: string) => {
      setOpenVpnForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const dialogTitle = editingVpn
    ? t("vpnForm.title.edit")
    : vpnType === "WireGuard"
      ? t("vpnForm.title.createWireGuard")
      : t("vpnForm.title.createOpenVpn");

  const dialogDescription = editingVpn
    ? t("vpnForm.description.edit")
    : vpnType === "WireGuard"
      ? t("vpnForm.description.createWireGuard")
      : t("vpnForm.description.createOpenVpn");

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 py-2">
            {!editingVpn && (
              <div className="grid gap-2">
                <Label>{t("vpnForm.fields.vpnType")}</Label>
                <Select
                  value={vpnType}
                  onValueChange={(value) => setVpnType(value as VpnType)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("vpnForm.placeholders.selectVpnType")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WireGuard">
                      {t("vpnForm.types.wireGuard")}
                    </SelectItem>
                    <SelectItem value="OpenVPN">
                      {t("vpnForm.types.openVpn")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {vpnType === "WireGuard" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="wg-name">{t("common.labels.name")}</Label>
                  <Input
                    id="wg-name"
                    value={wireGuardForm.name}
                    onChange={(e) => updateWireGuard("name", e.target.value)}
                    placeholder={t("vpnForm.placeholders.wireGuardName")}
                    disabled={isSubmitting}
                  />
                </div>

                {!editingVpn && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="wg-private-key">
                        {t("vpnForm.fields.privateKey")}
                      </Label>
                      <Input
                        id="wg-private-key"
                        value={wireGuardForm.privateKey}
                        onChange={(e) =>
                          updateWireGuard("privateKey", e.target.value)
                        }
                        placeholder={t("vpnForm.placeholders.privateKey")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="wg-address">
                        {t("vpnForm.fields.address")}
                      </Label>
                      <Input
                        id="wg-address"
                        value={wireGuardForm.address}
                        onChange={(e) =>
                          updateWireGuard("address", e.target.value)
                        }
                        placeholder={t("vpnForm.placeholders.address")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="wg-dns">
                          {t("vpnForm.fields.dnsOptional")}
                        </Label>
                        <Input
                          id="wg-dns"
                          value={wireGuardForm.dns}
                          onChange={(e) =>
                            updateWireGuard("dns", e.target.value)
                          }
                          placeholder={t("vpnForm.placeholders.dns")}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="wg-mtu">
                          {t("vpnForm.fields.mtuOptional")}
                        </Label>
                        <Input
                          id="wg-mtu"
                          type="number"
                          value={wireGuardForm.mtu}
                          onChange={(e) =>
                            updateWireGuard("mtu", e.target.value)
                          }
                          placeholder={t("vpnForm.placeholders.mtu")}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="wg-peer-public-key">
                        {t("vpnForm.fields.peerPublicKey")}
                      </Label>
                      <Input
                        id="wg-peer-public-key"
                        value={wireGuardForm.peerPublicKey}
                        onChange={(e) =>
                          updateWireGuard("peerPublicKey", e.target.value)
                        }
                        placeholder={t("vpnForm.placeholders.peerPublicKey")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="wg-peer-endpoint">
                        {t("vpnForm.fields.peerEndpoint")}
                      </Label>
                      <Input
                        id="wg-peer-endpoint"
                        value={wireGuardForm.peerEndpoint}
                        onChange={(e) =>
                          updateWireGuard("peerEndpoint", e.target.value)
                        }
                        placeholder={t("vpnForm.placeholders.peerEndpoint")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="wg-allowed-ips">
                        {t("vpnForm.fields.allowedIps")}
                      </Label>
                      <Input
                        id="wg-allowed-ips"
                        value={wireGuardForm.allowedIps}
                        onChange={(e) =>
                          updateWireGuard("allowedIps", e.target.value)
                        }
                        placeholder={t("vpnForm.placeholders.allowedIps")}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="wg-keepalive">
                          {t("vpnForm.fields.persistentKeepaliveOptional")}
                        </Label>
                        <Input
                          id="wg-keepalive"
                          type="number"
                          value={wireGuardForm.persistentKeepalive}
                          onChange={(e) =>
                            updateWireGuard(
                              "persistentKeepalive",
                              e.target.value,
                            )
                          }
                          placeholder={t("vpnForm.placeholders.keepalive")}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="wg-preshared-key">
                          {t("vpnForm.fields.presharedKeyOptional")}
                        </Label>
                        <Input
                          id="wg-preshared-key"
                          value={wireGuardForm.presharedKey}
                          onChange={(e) =>
                            updateWireGuard("presharedKey", e.target.value)
                          }
                          placeholder={t("vpnForm.placeholders.presharedKey")}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {vpnType === "OpenVPN" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="ovpn-name">{t("common.labels.name")}</Label>
                  <Input
                    id="ovpn-name"
                    value={openVpnForm.name}
                    onChange={(e) => updateOpenVpn("name", e.target.value)}
                    placeholder={t("vpnForm.placeholders.openVpnName")}
                    disabled={isSubmitting}
                  />
                </div>

                {!editingVpn && (
                  <div className="grid gap-2">
                    <Label htmlFor="ovpn-config">
                      {t("vpnForm.fields.rawConfig")}
                    </Label>
                    <Textarea
                      id="ovpn-config"
                      value={openVpnForm.rawConfig}
                      onChange={(e) =>
                        updateOpenVpn("rawConfig", e.target.value)
                      }
                      placeholder={t("vpnForm.placeholders.rawConfig")}
                      className="min-h-[200px] font-mono text-xs"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <RippleButton
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t("common.buttons.cancel")}
          </RippleButton>
          <LoadingButton isLoading={isSubmitting} onClick={handleSubmit}>
            {editingVpn
              ? t("vpnForm.actions.update")
              : t("vpnForm.actions.create")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
