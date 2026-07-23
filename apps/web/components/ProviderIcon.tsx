import { Cloud } from "lucide-react";
import { providerIconAssetFor } from "../lib/provider-icon-assets";

export function ProviderIcon({
  providerKey,
  className,
}: {
  providerKey: string;
  className: string;
}) {
  const asset = providerIconAssetFor(providerKey);
  const iconClassName = asset === undefined
    ? className
    : `${className} provider-mark-${asset.brandKey}`;

  return (
    <span aria-hidden="true" className={iconClassName}>
      {asset === undefined ? (
        <Cloud aria-hidden="true" className="provider-icon-fallback" strokeWidth={1.8} />
      ) : (
        <img alt="" draggable={false} src={`/provider-icons/${asset.filename}`} />
      )}
    </span>
  );
}
