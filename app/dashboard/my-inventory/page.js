export default function MyInventoryPage() {
  return (
    <section style={styles.card}>
      <h1 style={styles.title}>Mənim inventarlarım</h1>
      <p style={styles.text}>
        Burada istifadəçiyə təhkim olunmuş inventarlar görünəcək.
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