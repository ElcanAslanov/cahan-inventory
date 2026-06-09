export default function InventoryPage() {
  return (
    <section style={styles.card}>
      <h1 style={styles.title}>İnventarlar</h1>
      <p style={styles.text}>
        Burada bütün inventarların siyahısı, filter, export, əlavə etmə və
        düzəliş olacaq.
      </p>
    </section>
  );
}

const styles = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 24,
  },
  title: {
    margin: 0,
    color: "#0f172a",
  },
  text: {
    color: "#64748b",
  },
};