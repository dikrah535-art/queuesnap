import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, CheckCircle2, PackageCheck, Plus, QrCode, ScanLine, Smartphone, UserPlus, X } from "lucide-react";

type DemoDevice = {
  id: string;
  name: string;
  deviceId: string;
  status: "active" | "returned";
  collectedAt: string;
};

const SAMPLE_NAMES = ["Rahul", "Priya", "Jordan", "Sam", "Mei", "Alex", "Neha", "Vikram"];

const initialDevices: DemoDevice[] = [
  { id: "1", name: "Agresh Ji", deviceId: "QS101", status: "active", collectedAt: "10:32 AM" },
  { id: "3", name: "Rahul", deviceId: "QS103", status: "returned", collectedAt: "09:15 AM" },
];

const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const AdminDemoDashboard = () => {
  const [devices, setDevices] = useState<DemoDevice[]>(initialDevices);
  const [token, setToken] = useState("");
  const [returnTarget, setReturnTarget] = useState<DemoDevice | null>(null);

  const addUser = () => {
    const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
    const next: DemoDevice = {
      id: crypto.randomUUID(),
      name,
      deviceId: `QS${100 + devices.length + 1}`,
      status: "active",
      collectedAt: formatTime(),
    };
    setDevices((d) => [next, ...d]);
    toast.success(`${name} added to the queue`);
  };

  const ringDevice = () => {
    if (!token.trim()) {
      toast.error("Please enter a Token ID first");
      return;
    }
    toast.success("Device Connected ✅");
    setTimeout(() => toast("📞 Phone is ringing...", { duration: 2500 }), 600);
  };

  const scanQr = () => {
    toast("📷 QR scanner simulated — token captured", { duration: 2000 });
    setToken("QS102");
  };

  const confirmReturn = () => {
    if (!returnTarget) return;
    setDevices((d) =>
      d.map((x) =>
        x.id === returnTarget.id
          ? { ...x, status: "returned", collectedAt: formatTime() }
          : x
      )
    );
    toast.success("Device returned successfully ✅");
    setReturnTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">QueueSnap</Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Demo Mode</Badge>
            <Button asChild variant="ghost" size="sm"><Link to="/">Exit</Link></Button>
          </div>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Welcome, Agresh Ji 👋
          </h1>
          <p className="text-muted-foreground mt-1">Manage devices and the pickup queue.</p>
        </div>

        {/* Action panels */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Add user */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Add User</h2>
                <p className="text-xs text-muted-foreground">Create a new entry in the queue</p>
              </div>
            </div>
            <Button onClick={addUser} className="w-full" variant="hero">
              <Plus /> Add User
            </Button>
          </Card>

          {/* Scan / Ring */}
          <Card className="p-6 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ScanLine className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold">Scan QR / Enter Token</h2>
                <p className="text-xs text-muted-foreground">Identify a device to ring it</p>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Enter Token ID (e.g. QS102)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={scanQr}>
                  <QrCode /> Scan QR
                </Button>
                <Button onClick={ringDevice}>
                  <Bell /> Ring Device
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Device cards */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Devices</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {devices.map((d) => (
              <Card key={d.id} className="p-5 shadow-card animate-fade-in">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-foreground">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{d.deviceId}</div>
                    </div>
                  </div>
                  {d.status === "active" ? (
                    <Badge className="bg-success/15 text-success hover:bg-success/15">
                      🟢 Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">🔴 Returned</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-4">
                  {d.status === "returned" ? "Returned at " : "Collected at "}
                  {d.collectedAt}
                </div>
                <Button
                  variant={d.status === "returned" ? "secondary" : "outline"}
                  className="w-full"
                  disabled={d.status === "returned"}
                  onClick={() => setReturnTarget(d)}
                >
                  <PackageCheck /> {d.status === "returned" ? "Returned" : "Return Device"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <AlertDialog open={!!returnTarget} onOpenChange={(o) => !o && setReturnTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to return{" "}
              <span className="font-semibold text-foreground">{returnTarget?.name}</span>'s device
              ({returnTarget?.deviceId})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReturn}>Confirm Return</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDemoDashboard;
