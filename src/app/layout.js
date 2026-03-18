import "./globals.css"; // Importa los estilos globales aquí
import ClientWrapper from "./components/ClientWrapper";
import ThemeRegistry from "./ThemeRegistry";

export const metadata = {
  title: "Maqui+",
  description: "Descripción de tu aplicación",
  icons: {
    icon: "/logo_maqui.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <ThemeRegistry>
          <ClientWrapper>{children}</ClientWrapper>
        </ThemeRegistry>
      </body>
    </html>
  );
}
