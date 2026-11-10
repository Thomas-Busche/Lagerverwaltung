import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertTitle, Box, Button, Chip, Stack, Typography } from "@mui/material";
import { fetchOverdueOrders, type OverdueOrderDto } from "../../utils/api";
import useAuthStore from "../../store/useAuthStore";
import { isEffectivelyOffline } from "../../store/useNetworkStore";
import { useUserSettingsStore } from "../../store/useUserSettingsStore";

const OPEN_ORDERS_PATH = "/orders?tab=offen";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("de-DE");

const DashboardOverdueOrdersWidget: React.FC = () => {
  const navigate = useNavigate();
  const canViewOrders = useAuthStore((state) => state.hasPermission("orders.view"));
  const overdueDays = useUserSettingsStore((state) => state.settings.overdueOrderDays);
  const settingsLoaded = useUserSettingsStore((state) => state.loaded);
  const [orders, setOrders] = useState<OverdueOrderDto[]>([]);

  useEffect(() => {
    // Wait for the saved threshold; otherwise the default would be fetched first and then replaced.
    if (!canViewOrders || !settingsLoaded || isEffectivelyOffline()) return;

    let active = true;
    fetchOverdueOrders(overdueDays)
      .then((data) => {
        if (active) setOrders(data);
      })
      .catch((error: unknown) => {
        console.warn("[DashboardOverdueOrders] Laden fehlgeschlagen:", error);
      });
    return () => {
      active = false;
    };
  }, [canViewOrders, settingsLoaded, overdueDays]);

  // Nothing overdue: the widget stays out of the way instead of showing an empty card.
  if (!canViewOrders || orders.length === 0) return null;

  return (
    <Alert
      severity="warning"
      action={
        <Button color="inherit" size="small" onClick={() => navigate(OPEN_ORDERS_PATH)}>
          Zu den offenen Bestellungen
        </Button>
      }
    >
      <AlertTitle>
        {orders.length === 1
          ? `1 Bestellung wartet seit über ${overdueDays} Tagen auf Lieferung`
          : `${orders.length} Bestellungen warten seit über ${overdueDays} Tagen auf Lieferung`}
      </AlertTitle>
      <Stack spacing={0.75} sx={{ mt: 1 }}>
        {orders.map((order) => (
          <Box
            key={order.id}
            sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, cursor: "pointer" }}
            onClick={() => navigate(OPEN_ORDERS_PATH)}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {order.orderNumber || "Ohne Bestellnummer"}
            </Typography>
            <Typography variant="body2">{order.supplierName}</Typography>
            <Typography variant="body2" color="text.secondary">
              bestellt am {formatDate(order.orderedAt)}
            </Typography>
            <Chip size="small" color="warning" label={`seit ${order.ageDays} Tagen`} />
            <Chip
              size="small"
              variant="outlined"
              label={`offen: ${order.openQuantity} Stk. in ${order.openLines} ${order.openLines === 1 ? "Position" : "Positionen"}`}
            />
          </Box>
        ))}
      </Stack>
    </Alert>
  );
};

export default DashboardOverdueOrdersWidget;
