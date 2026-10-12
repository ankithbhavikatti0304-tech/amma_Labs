/** Re-mounts on every navigation, which replays the prototype's small fade-up between views. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="view-in">{children}</div>;
}
