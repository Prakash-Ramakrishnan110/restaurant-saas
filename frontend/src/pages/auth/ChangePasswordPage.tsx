import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "../../components/brand/BrandLogo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { useAuth } from "../../context/AuthContext";

export const ChangePasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { changePassword, logout } = useAuth();
  const navigate = useNavigate();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 8) {
      setErrorMsg(t("auth.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg(t("auth.passwordMismatch"));
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(oldPassword, newPassword);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        err?.message ||
        "Failed to update password. Please check your current password.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <BrandLogo size={40} className="justify-center" />
        </div>

        <Card className="border shadow-lg">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-[#FFF3E0] dark:bg-[#0B1F3B] text-[#FF6A00] flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold font-display text-[#0B1F3B] dark:text-white">
              {t("auth.mustChangePassword")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("auth.mustChangePasswordDesc")}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {errorMsg && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-400 font-medium"
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="old-password"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  {t("auth.currentPassword")}
                </label>
                <Input
                  id="old-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  {t("auth.newPassword")}
                </label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  {t("auth.confirmPassword")}
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span>Minimum 8 characters length</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                  <span>Cannot match previous password</span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full h-11 text-base font-bold shadow"
                disabled={isSubmitting}
              >
                {isSubmitting ? t("common.loading") : t("auth.changePasswordButton")}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => logout().then(() => navigate("/login"))}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {t("auth.signOut")}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
