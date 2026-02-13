import { useLocation } from "react-router-dom";

export default function Placeholder() {
  const { pathname } = useLocation();
  const name = pathname.slice(1).charAt(0).toUpperCase() + pathname.slice(2);

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground">{name}</h1>
      <p className="mt-2 text-muted-foreground">This page is coming soon.</p>
    </div>
  );
}
