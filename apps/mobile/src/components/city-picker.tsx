import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { loadCity, searchCities } from "@/features/cities/api";
import { cityDetail, cityLabel, type City } from "@squad-six/shared";
import { useEffect, useRef, useState } from "react";
import { minTouch, radius, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Props = {
  label: string;
  /** The chosen city's id. */
  value: number | null;
  onChange: (cityId: number | null) => void;
};

// Search-and-pick city field. A city can only be chosen from the server's list, never typed in.
export function CityPicker({ label, value, onChange }: Props) {
  const c = usePalette();
  const [chosen, setChosen] = useState<City | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<City[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  // A saved answer only has the id: look up its name once.
  const needsLookup = value !== null && chosen?.id !== value;
  useEffect(() => {
    if (!needsLookup || value === null) return;
    let cancelled = false;
    loadCity(value)
      .then((city) => {
        if (!cancelled) setChosen(city);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsLookup, value]);

  function search(text: string) {
    setQuery(text);
    const call = ++latest.current;
    if (text.trim().length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    // Wait for a pause in typing, and ignore answers to older searches.
    setTimeout(async () => {
      if (call !== latest.current) return;
      try {
        const found = await searchCities(text);
        if (call !== latest.current) return;
        setResults(found);
        setFailed(false);
      } catch {
        if (call !== latest.current) return;
        setResults(null);
        setFailed(true);
      } finally {
        if (call === latest.current) setSearching(false);
      }
    }, 250);
  }

  if (value !== null && chosen?.id === value) {
    return (
      <View style={styles.stack}>
        <T variant="label">{label}</T>
        <View style={[styles.chosen, { borderColor: c.accent, backgroundColor: c.surface }]}>
          <View style={styles.rowText}>
            <T>{cityLabel(chosen)}</T>
            <T variant="small" tone="textMuted">
              {chosen.country}
            </T>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a different city"
            onPress={() => {
              setChosen(null);
              setQuery("");
              setResults(null);
              onChange(null);
            }}
            style={styles.change}
          >
            <T variant="label" tone="accent">
              Change
            </T>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <TextField
        label={label}
        value={query}
        onChangeText={search}
        placeholder="Start typing your city"
        autoCapitalize="words"
        autoCorrect={false}
        textContentType="addressCity"
      />
      {searching && <ActivityIndicator accessibilityLabel="Searching cities" />}
      {failed && (
        <T variant="small" tone="danger" accessibilityLiveRegion="polite">
          Couldn&apos;t search right now. Check your connection and keep typing to try again.
        </T>
      )}
      {results?.length === 0 && !searching && (
        <T variant="small" tone="textMuted" accessibilityLiveRegion="polite">
          No city found. The list has cities with more than 15,000 people, so try the nearest larger one.
        </T>
      )}
      {results?.map((city) => (
        <Pressable
          key={city.id}
          accessibilityRole="button"
          accessibilityLabel={`${city.name}, ${cityDetail(city)}`}
          onPress={() => {
            setChosen(city);
            setResults(null);
            onChange(city.id);
          }}
          style={({ pressed }) => [styles.result, { borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <T>{city.name}</T>
          <T variant="small" tone="textMuted">
            {cityDetail(city)}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  chosen: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: minTouch + 4,
    borderWidth: 2,
    borderRadius: radius.md,
    paddingLeft: space.md,
    paddingVertical: space.sm,
  },
  rowText: { flex: 1, gap: 2 },
  change: { minHeight: minTouch, minWidth: minTouch, justifyContent: "center", paddingHorizontal: space.md },
  result: { minHeight: minTouch + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, justifyContent: "center" },
});
