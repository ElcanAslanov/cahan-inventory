export default function UsersPage() {
  return (
    <section style={styles.card}>
      <h1 style={styles.title}>İstifadəçilər</h1>
      <p style={styles.text}>
        Burada admin istifadəçiləri yaradacaq və rollar təyin olunacaq.
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