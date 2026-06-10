export default function InventoryStatusPill({ status }) {
  const labels = {
    IN_STOCK: "Anbarda",
    ASSIGNED: "Təhkim olunub",
    IN_REPAIR: "Təmirdə",
    LOST: "İtib",
    WRITTEN_OFF: "Silinib",
    DISPOSED: "İstifadədən çıxarılıb",
  };

  return (
    <span className={`inventory-status status-${status || "IN_STOCK"}`}>
      {labels[status] || status || "-"}
    </span>
  );
}