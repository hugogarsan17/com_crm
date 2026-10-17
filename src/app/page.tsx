import { redirect } from "next/navigation";

// El proxy ya redirige "/" según haya sesión o no; esto es solo un respaldo.
export default function Home() {
  redirect("/dashboard");
}
