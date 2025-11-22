export function Spinner({ size = "md", color = "primary" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const colorClasses = {
    primary: "text-blue-500",
    secondary: "text-purple-500",
    accent: "text-amber-500",
    dark: "text-gray-800 dark:text-gray-200",
    light: "text-white",
  };

  return (
    <div className={`${sizeClasses[size]} ${colorClasses[color]} inline-flex animate-spin`}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.8" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="spinner-inner" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="url(#spinner-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="180 100"
        />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="url(#spinner-inner)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="100 60"
          transform="rotate(180 50 50)"
        />
        <circle cx="50" cy="50" r="15" fill="currentColor" opacity="0.7" />
      </svg>
    </div>
  );
}
