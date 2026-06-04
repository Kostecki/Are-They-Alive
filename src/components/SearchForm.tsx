import { Alert, Box, type BoxProps, Divider } from "@mantine/core";
import ky from "ky";
import { useCallback, useEffect, useRef, useState } from "react";

import type { NormalizedCast, Result } from "~/types";

import { useCastSorting } from "~/hooks/useCastSorting";
import { useMediaSearch } from "~/hooks/useMediaSearch";

import CastList from "./CastList";
import { GroupSortHeader } from "./GroupSortHeader";
import ItemDetails from "./ItemDetails";
import SearchInput from "./SearchInput";

type InputProps = {
	initialItem?: Result;
} & BoxProps;

export default function SearchForm({ initialItem, ...props }: InputProps) {
	const [debounced, setDebounced] = useState("");
	const [selectedItem, setSelectedItem] = useState<Result | null>(
		initialItem ?? null,
	);
	const [rawCast, setRawCast] = useState<NormalizedCast[]>([]);
	const [loadingCast, setLoadingCast] = useState(true);
	const [castTotal, setCastTotal] = useState(0);
	const [castError, setCastError] = useState<string | null>(null);
	const [groupByStatus, setGroupByStatus] = useState(true);
	const [sortBy, setSortBy] = useState("appearance");
	const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

	const castEndRef = useRef<HTMLDivElement>(null);
	const selectedRef = useRef<Result | null>(null);

	// Use custom hooks for search and sorting
	const { results, loading, error: searchError } = useMediaSearch(debounced);
	const castSections = useCastSorting(
		rawCast,
		groupByStatus,
		sortBy,
		sortOrder,
	);

	const hasMoreCast = rawCast.length < castTotal;

	const fetchCast = useCallback(
		async (item: Result, reset = false, offset?: number) => {
			setLoadingCast(true);
			setCastError(null);
			try {
				const data = (await ky
					.post("/api/credits", {
						timeout: 30_000,
						json: {
							id: item.id,
							type: item.mediaType,
							offset: reset ? 0 : (offset ?? 0),
						},
					})
					.json()) as {
					id: number;
					type: "movie" | "tv";
					cast: NormalizedCast[];
					total: number;
				};

				setRawCast((prev) => (reset ? data.cast : [...prev, ...data.cast]));
				setCastTotal(data.total);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Failed to load cast members";
				setCastError(errorMessage);
				console.error("Error fetching cast:", err);
			} finally {
				setLoadingCast(false);
			}
		},
		[],
	);

	useEffect(() => {
		if (!selectedItem) return;

		setRawCast([]);
		setCastTotal(0);
		setLoadingCast(true);

		fetchCast(selectedItem, true);
	}, [selectedItem, fetchCast]);

	useEffect(() => {
		selectedRef.current = selectedItem;
	}, [selectedItem]);

	// Sync state when initialItem prop changes (e.g., navigation)
	useEffect(() => {
		if (initialItem) {
			setSelectedItem(initialItem);
		}
	}, [initialItem]);

	return (
		<Box {...props}>
			<SearchInput
				onDebouncedChange={setDebounced}
				results={results}
				loading={loading}
			/>
			{searchError && (
				<Alert title="Search Error" color="red" mt="md" withCloseButton>
					{searchError}
				</Alert>
			)}
			{selectedItem && (
				<>
					<Divider my="lg" />

					<ItemDetails item={selectedItem} />

					<Divider mb="md" mt="xl" opacity="0.6" />

					<GroupSortHeader
						groupByStatus={groupByStatus}
						setGroupByStatus={setGroupByStatus}
						sortBy={sortBy}
						setSortBy={setSortBy}
						sortOrder={sortOrder}
						setSortOrder={setSortOrder}
					/>

					<Divider my="md" opacity="0.6" />

					{castError && (
						<Alert
							title="Cast Loading Error"
							color="red"
							mb="md"
							withCloseButton
							onClose={() => setCastError(null)}
						>
							{castError}
						</Alert>
					)}

					<CastList
						castSections={castSections}
						loadingCast={loadingCast}
						hasMoreCast={hasMoreCast}
						loadMore={() =>
							selectedItem && fetchCast(selectedItem, false, rawCast.length)
						}
						castEndRef={castEndRef}
						groupByStatus={groupByStatus}
					/>
				</>
			)}
		</Box>
	);
}
