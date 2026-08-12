"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import styles from "./AddressAutocomplete.module.css";

type AddressValue = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  addressComponents?: AddressComponent[];
  formattedAddress?: string;
  fetchFields(options: { fields: string[] }): Promise<void>;
};

type PlaceSelectEvent = Event & {
  placePrediction?: { toPlace(): GooglePlace };
};

type PlaceAutocompleteElement = HTMLElement & {
  placeholder?: string;
};

type PlacesLibrary = {
  PlaceAutocompleteElement: new (options?: Record<string, unknown>) => PlaceAutocompleteElement;
};

type GoogleMapsApi = {
  maps: {
    importLibrary?: (name: "places") => Promise<PlacesLibrary>;
    places?: PlacesLibrary;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

function componentValue(components: AddressComponent[], type: string, short = false) {
  const component = components.find((item) => item.types?.includes(type));
  return (short ? component?.shortText : component?.longText) || "";
}

function parsePlace(place: GooglePlace): AddressValue {
  const components = place.addressComponents || [];
  const streetNumber = componentValue(components, "street_number");
  const route = componentValue(components, "route");
  const city =
    componentValue(components, "locality") ||
    componentValue(components, "postal_town") ||
    componentValue(components, "sublocality_level_1") ||
    componentValue(components, "administrative_area_level_2");

  return {
    address: [streetNumber, route].filter(Boolean).join(" ") || place.formattedAddress || "",
    city,
    state: componentValue(components, "administrative_area_level_1", true),
    zip: componentValue(components, "postal_code"),
  };
}

export default function AddressAutocomplete({
  value,
  onChange,
}: {
  value: AddressValue;
  onChange(value: AddressValue): void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [mapsReady, setMapsReady] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !mapsReady || !window.google?.maps || !containerRef.current) return;
    let cancelled = false;
    let element: PlaceAutocompleteElement | null = null;

    const loadPlaces = async () => {
      const maps = window.google?.maps;
      if (!maps) return;

      const places =
        typeof maps.importLibrary === "function"
          ? await maps.importLibrary("places")
          : maps.places;
      if (!places?.PlaceAutocompleteElement) return;

      const { PlaceAutocompleteElement } = places;
      if (cancelled || !containerRef.current) return;
      element = new PlaceAutocompleteElement({ includedRegionCodes: ["us"] });
      element.placeholder = "Start typing your street address";
      element.addEventListener("gmp-select", async (event) => {
        const prediction = (event as PlaceSelectEvent).placePrediction;
        if (!prediction) return;
        const place = prediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "addressComponents"] });
        const parsed = parsePlace(place);
        onChangeRef.current(parsed);
      });
      containerRef.current.replaceChildren(element);
      setGoogleReady(true);
    };

    loadPlaces().catch(() => {
      // Keep the normal address input available when Google is unavailable.
      setGoogleReady(false);
    });

    return () => {
      cancelled = true;
      element?.remove();
    };
  }, [apiKey, mapsReady]);

  return (
    <>
      {apiKey && (
        <Script
          id="fca-google-maps"
          src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&libraries=places`}
          strategy="afterInteractive"
          onReady={() => setMapsReady(true)}
          onError={() => setGoogleReady(false)}
        />
      )}
      {apiKey && <div ref={containerRef} className={styles.container} />}
      {!googleReady && (
        <input
          autoComplete="street-address"
          value={value.address}
          onChange={(event) => onChange({ ...value, address: event.target.value })}
          placeholder="Street address"
        />
      )}
      {googleReady && value.address && <p className="microcopy">Selected: {value.address}</p>}
    </>
  );
}
