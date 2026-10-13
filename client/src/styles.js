export const styles = {
page: {
minHeight: "100vh",
backgroundColor: "#f4f6f9",
color: "#202938",
fontFamily: "Arial, sans-serif",
},

header: {
backgroundColor: "#ffffff",
borderBottom: "1px solid #e5e7eb",
padding: "18px 6%",
display: "flex",
justifyContent: "space-between",
alignItems: "center",
flexWrap: "wrap",
gap: "15px",
},

brand: {
margin: 0,
fontSize: "25px",
color: "#176b55",
},

container: {
maxWidth: "1100px",
margin: "0 auto",
padding: "30px 20px",
},

welcome: {
marginBottom: "25px",
},

muted: {
color: "#687386",
lineHeight: 1.6,
},

grid: {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
gap: "18px",
marginBottom: "28px",
},

card: {
backgroundColor: "#ffffff",
padding: "22px",
borderRadius: "10px",
border: "1px solid #e5e7eb",
marginBottom: "22px",
},

statNumber: {
fontSize: "30px",
fontWeight: "bold",
margin: "10px 0 0",
color: "#176b55",
},

sectionTitle: {
marginTop: 0,
marginBottom: "18px",
fontSize: "21px",
},

label: {
display: "block",
marginBottom: "8px",
fontWeight: "bold",
fontSize: "14px",
},

input: {
width: "100%",
boxSizing: "border-box",
padding: "12px",
border: "1px solid #d1d5db",
borderRadius: "6px",
fontSize: "15px",
marginBottom: "18px",
backgroundColor: "#ffffff",
color: "#202938",
caretColor: "#176b55",
colorScheme: "light",
},

textarea: {
width: "100%",
minHeight: "120px",
boxSizing: "border-box",
padding: "12px",
border: "1px solid #d1d5db",
borderRadius: "6px",
fontSize: "15px",
resize: "vertical",
fontFamily: "Arial, sans-serif",
marginBottom: "18px",
},

button: {
backgroundColor: "#176b55",
color: "#ffffff",
border: "none",
borderRadius: "6px",
padding: "12px 18px",
fontSize: "14px",
fontWeight: "bold",
cursor: "pointer",
},

secondaryButton: {
backgroundColor: "#ffffff",
color: "#176b55",
border: "1px solid #176b55",
borderRadius: "6px",
padding: "10px 15px",
fontSize: "14px",
fontWeight: "bold",
cursor: "pointer",
},

roomGrid: {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
gap: "18px",
},

roomLabel: {
color: "#687386",
fontSize: "13px",
marginBottom: "7px",
},

roomValue: {
fontSize: "16px",
fontWeight: "bold",
overflowWrap: "anywhere",
},

requestCard: {
backgroundColor: "#ffffff",
padding: "20px",
borderRadius: "9px",
border: "1px solid #e5e7eb",
marginTop: "14px",
},

message: {
padding: "13px 15px",
backgroundColor: "#e9f6ef",
color: "#176b45",
borderRadius: "6px",
marginBottom: "20px",
},

error: {
padding: "13px 15px",
backgroundColor: "#fff0f0",
color: "#a12626",
borderRadius: "6px",
marginBottom: "20px",
},

loginPage: {
minHeight: "100vh",
backgroundColor: "#f4f6f9",
display: "flex",
justifyContent: "center",
alignItems: "center",
padding: "20px",
boxSizing: "border-box",
},

loginCard: {
width: "100%",
maxWidth: "400px",
backgroundColor: "#ffffff",
padding: "32px",
borderRadius: "12px",
border: "1px solid #e5e7eb",
boxSizing: "border-box",
},
};

export function getStatusStyle(status) {
const colors = {
pending: { background: "#fff4d6", color: "#875b00" },
approved: { background: "#e0edff", color: "#1d4f91" },
assigned: { background: "#eee5ff", color: "#6536a3" },
in_progress: { background: "#dff5f2", color: "#12675e" },
completed: { background: "#dff5e5", color: "#216e39" },
cancelled: { background: "#fee2e2", color: "#991b1b" },
};

const selected = colors[status] || {
background: "#eeeeee",
color: "#444444",
};

return {
display: "inline-block",
backgroundColor: selected.background,
color: selected.color,
padding: "6px 10px",
borderRadius: "20px",
fontSize: "12px",
fontWeight: "bold",
textTransform: "capitalize",
};
}
