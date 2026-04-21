/// <reference types="google.maps" />
import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { GOOGLE_MAPS_API_KEY } from "@/lib/constants";
import { MapPin, AlertTriangle } from "lucide-react";

export interface AddressData {
  address: string;
  address_line?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  google_place_id?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onAddressSelect?: (data: AddressData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

let googleMapsLoaded = false;
let googleMapsLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGoogleMaps(): Promise<void> {
  return new Promise((resolve) => {
    if (googleMapsLoaded) return resolve();
    loadCallbacks.push(resolve);
    if (googleMapsLoading) return;
    googleMapsLoading = true;

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=fr`;
    script.async = true;
    script.onload = () => {
      googleMapsLoaded = true;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      googleMapsLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

function extractAddressComponents(place: google.maps.places.PlaceResult): AddressData {
  const components = place.address_components ?? [];
  const get = (type: string) => components.find((c) => c.types.includes(type))?.long_name ?? "";

  const streetNumber = get("street_number");
  const route = get("route");
  const addressLine = [streetNumber, route].filter(Boolean).join(" ");

  return {
    address: place.formatted_address ?? "",
    address_line: addressLine || undefined,
    postal_code: get("postal_code") || undefined,
    city: get("locality") || get("administrative_area_level_2") || undefined,
    country: get("country") || undefined,
    google_place_id: place.place_id ?? undefined,
    lat: place.geometry?.location?.lat(),
    lng: place.geometry?.location?.lng(),
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "12 rue de la Paix, 75002 Paris",
  className,
  disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);
  const [selectedFromGoogle, setSelectedFromGoogle] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);

  // Stable refs for callbacks to avoid re-initializing autocomplete
  const onChangeRef = useRef(onChange);
  const onAddressSelectRef = useRef(onAddressSelect);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onAddressSelectRef.current = onAddressSelect;
  }, [onAddressSelect]);

  // Load Google Maps if API key exists
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    loadGoogleMaps().then(() => {
      if (window.google?.maps?.places) {
        setIsGoogleReady(true);
      }
    });
  }, []);

  // Initialize autocomplete — only once when Google is ready
  useEffect(() => {
    if (!isGoogleReady || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "fr" },
      fields: ["address_components", "formatted_address", "geometry", "place_id"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.formatted_address) return;

      const data = extractAddressComponents(place);
      setSelectedFromGoogle(true);
      setHasTyped(false);
      onChangeRef.current(data.address);
      onAddressSelectRef.current?.(data);
    });

    autocompleteRef.current = autocomplete;

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [isGoogleReady]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasTyped(true);
      setSelectedFromGoogle(false);
      onChange(e.target.value);
    },
    [onChange],
  );

  const showWarning = hasTyped && !selectedFromGoogle && value.length > 5 && isGoogleReady;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`pl-9 ${className ?? ""}`}
          disabled={disabled}
          autoComplete="off"
        />
      </div>
      {showWarning && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Pour une adresse plus fiable, sélectionnez une suggestion Google.
        </p>
      )}
      {!GOOGLE_MAPS_API_KEY && value.length > 0 && (
        <p className="text-xs text-muted-foreground italic">
          Autocomplétion Google Maps non configurée – saisie libre.
        </p>
      )}
    </div>
  );
}
