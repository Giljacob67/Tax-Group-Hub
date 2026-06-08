import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { motion } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  QrCode,
  Key,
  Copy,
  Check,
  AlertCircle,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
}

export default function TwoFactorPage() {
  usePageTitle("Autenticação em Dois Fatores");
  const { token } = useAuth();
  const { toast } = useToast();

  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/auth/2fa/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch 2FA status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async () => {
    setIsSettingUp(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setSetupData({ secret: data.secret, qrCode: data.qrCode });
      } else {
        toast({ title: data.message || "Erro ao configurar 2FA", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao configurar 2FA", variant: "destructive" });
    }
  };

  const handleVerify = async () => {
    if (!verifyToken || verifyToken.length !== 6) {
      toast({ title: "Token deve ter 6 dígitos", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: verifyToken }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.backupCodes) {
          setBackupCodes(data.backupCodes);
          setShowBackupDialog(true);
        } else {
          toast({ title: "2FA ativado com sucesso!" });
        }
        setSetupData(null);
        setVerifyToken("");
        fetchStatus();
      } else {
        toast({ title: data.message || "Token inválido", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao verificar token", variant: "destructive" });
    }
  };

  const handleDisable = async () => {
    if (!password) {
      toast({ title: "Digite sua senha", variant: "destructive" });
      return;
    }

    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "2FA desativado com sucesso" });
        setPassword("");
        fetchStatus();
      } else {
        toast({ title: data.message || "Erro ao desativar 2FA", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erro ao desativar 2FA", variant: "destructive" });
    }
  };

  const copySecret = () => {
    if (setupData) {
      navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyBackupCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      toast({ title: "Códigos copiados!" });
    }
  };

  const downloadBackupCodes = () => {
    if (!backupCodes) return;
    const content = `Tax Group Hub - Códigos de Backup 2FA\nGerado em: ${new Date().toLocaleDateString("pt-BR")}\n\n${backupCodes.join("\n")}\n\nGuarde estes códigos em local seguro. Cada código pode ser usado uma vez.`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "taxgroup-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Autenticação em Dois Fatores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione uma camada extra de segurança à sua conta
          </p>
        </motion.div>

        {status?.enabled ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <CardTitle>2FA Ativado</CardTitle>
                  <CardDescription>
                    Sua conta está protegida com autenticação em dois fatores
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.verifiedAt && (
                <p className="text-sm text-muted-foreground">
                  Ativado em: {new Date(status.verifiedAt).toLocaleDateString("pt-BR")}
                </p>
              )}

              <div className="pt-4 border-t border-border/50">
                <h3 className="text-sm font-medium text-foreground mb-2">
                  Desativar 2FA
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Digite sua senha para desativar a autenticação em dois fatores.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="destructive"
                    onClick={handleDisable}
                    disabled={!password}
                  >
                    Desativar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <ShieldOff className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle>2FA Desativado</CardTitle>
                  <CardDescription>
                    Proteja sua conta com autenticação em dois fatores
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!setupData ? (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      A autenticação em dois fatores adiciona uma camada extra de segurança.
                      Após ativar, você precisará de um código do seu app autenticador além da senha.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">
                      Apps compatíveis:
                    </h3>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Google Authenticator</li>
                      <li>Authy</li>
                      <li>Microsoft Authenticator</li>
                      <li>1Password</li>
                    </ul>
                  </div>

                  <Button onClick={handleSetup} className="w-full">
                    <QrCode className="w-4 h-4 mr-2" />
                    Configurar 2FA
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      1. Escaneie o QR Code
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Use seu app autenticador para escanear o QR code abaixo
                    </p>
                    <div className="inline-block p-4 bg-white rounded-lg">
                      <img src={setupData.qrCode} alt="QR Code 2FA" className="w-48 h-48" />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      Ou insira a chave manualmente
                    </h3>
                    <div className="flex gap-2">
                      <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm font-mono break-all">
                        {setupData.secret}
                      </code>
                      <Button variant="outline" size="icon" onClick={copySecret}>
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/50">
                    <h3 className="text-sm font-medium text-foreground mb-2">
                      2. Digite o código de verificação
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      Digite o código de 6 dígitos do seu app autenticador
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="000000"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="flex-1 text-center text-lg tracking-widest font-mono"
                        maxLength={6}
                      />
                      <Button onClick={handleVerify} disabled={verifyToken.length !== 6}>
                        <Key className="w-4 h-4 mr-2" />
                        Verificar
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSetupData(null);
                      setVerifyToken("");
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showBackupDialog} onOpenChange={(open) => {
          if (!open) {
            setShowBackupDialog(false);
            setBackupCodes(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                2FA Ativado com Sucesso!
              </DialogTitle>
              <DialogDescription>
                Guarde estes códigos de backup em local seguro. Cada código pode ser usado uma vez caso perca acesso ao seu app autenticador.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Estes códigos não serão mostrados novamente. Salve-os agora!
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                {backupCodes?.map((code, i) => (
                  <div key={i} className="text-center py-1">{code}</div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={copyBackupCodes}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar
                </Button>
                <Button variant="outline" className="flex-1" onClick={downloadBackupCodes}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => {
                setShowBackupDialog(false);
                setBackupCodes(null);
              }}>
                Guardei meus códigos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
