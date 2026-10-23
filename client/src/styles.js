const colors = {
  primary: "#203b56",
  primaryHover: "#172d43",
  accent: "#28745b",
  accentHover: "#205d49",
  background: "#f4f6f8",
  surface: "#ffffff",
  text: "#263445",
  muted: "#6b7787",
  border: "#e1e6eb",
};

export const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: '"Segoe UI", Arial, sans-serif',
  },

  header: {
    backgroundColor: colors.surface,
    borderBottom: `1px solid ${colors.border}`,
    padding: "16px 6%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "15px",
  },

  brand: {
    margin: 0,
    fontSize: "25px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
    color: colors.primary,
  },

  container: {
    width: "100%",
    maxWidth: "1160px",
    margin: "0 auto",
    padding: "32px 24px",
    boxSizing: "border-box",
  },

  welcome: {
    marginBottom: "26px",
  },

  muted: {
    color: colors.muted,
    lineHeight: 1.6,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "18px",
    marginBottom: "28px",
  },

  card: {
    backgroundColor: colors.surface,
    padding: "24px",
    borderRadius: "10px",
    border: `1px solid ${colors.border}`,
    marginBottom: "22px",
  },

  statNumber: {
    fontSize: "32px",
    fontWeight: 700,
    margin: "8px 0 0",
    color: colors.primary,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "18px",
    fontSize: "21px",
    fontWeight: 650,
    color: colors.primary,
  },

  label: {
    display: "block",
    marginBottom: "7px",
    fontWeight: 600,
    fontSize: "14px",
    color: colors.text,
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 13px",
    border: `1px solid #cbd3dc`,
    borderRadius: "7px",
    fontSize: "14px",
    marginBottom: "18px",
    backgroundColor: colors.surface,
    color: colors.text,
    caretColor: colors.accent,
    colorScheme: "light",
  },

  textarea: {
    width: "100%",
    minHeight: "120px",
    boxSizing: "border-box",
    padding: "12px 13px",
    border: "1px solid #cbd3dc",
    borderRadius: "7px",
    fontSize: "14px",
    resize: "vertical",
    fontFamily: '"Segoe UI", Arial, sans-serif',
    marginBottom: "18px",
    backgroundColor: colors.surface,
    color: colors.text,
  },

  button: {
    backgroundColor: colors.primary,
    color: "#ffffff",
    border: `1px solid ${colors.primary}`,
    borderRadius: "7px",
    padding: "11px 18px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  secondaryButton: {
    backgroundColor: colors.surface,
    color: colors.primary,
    border: `1px solid #cbd3dc`,
    borderRadius: "7px",
    padding: "10px 15px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },

  roomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "22px",
  },

  roomLabel: {
    color: colors.muted,
    fontSize: "13px",
    marginBottom: "6px",
  },

  roomValue: {
    fontSize: "16px",
    fontWeight: 600,
    color: colors.primary,
    overflowWrap: "anywhere",
  },

  requestCard: {
    backgroundColor: colors.surface,
    padding: "22px",
    borderRadius: "10px",
    border: `1px solid ${colors.border}`,
    marginTop: "14px",
    marginBottom: "16px",
  },

  message: {
    padding: "13px 16px",
    backgroundColor: "#e8f4ed",
    color: "#216344",
    border: "1px solid #c9e5d3",
    borderRadius: "7px",
    marginBottom: "20px",
  },

  error: {
    padding: "13px 16px",
    backgroundColor: "#fff0f0",
    color: "#a12626",
    border: "1px solid #f2cccc",
    borderRadius: "7px",
    marginBottom: "20px",
  },

  loginPage: {
    minHeight: "100vh",
    backgroundColor: colors.background,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
  },

  loginCard: {
    width: "100%",
    maxWidth: "410px",
    backgroundColor: colors.surface,
    padding: "32px",
    borderRadius: "10px",
    border: `1px solid ${colors.border}`,
    boxSizing: "border-box",
  },
};

export function getStatusStyle(status) {
  const statusColors = {
    pending: { background: "#fff4d6", color: "#875b00" },
    approved: { background: "#e5edfb", color: "#28558a" },
    assigned: { background: "#eee8fa", color: "#6941a5" },
    in_progress: { background: "#dff2ef", color: "#17685e" },
    completed: { background: "#e1f3e6", color: "#216e39" },
    cancelled: { background: "#fee8e7", color: "#a12c2c" },
  };

  const selected = statusColors[status] || {
    background: "#edf0f3",
    color: "#4b5563",
  };

  return {
    display: "inline-block",
    backgroundColor: selected.background,
    color: selected.color,
    padding: "6px 11px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 650,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  };
}
