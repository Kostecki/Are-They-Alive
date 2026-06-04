import {
	Combobox,
	Loader,
	Stack,
	Text,
	TextInput,
	useCombobox,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useNavigate } from "@tanstack/react-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import type { Result } from "~/types";

type InputProps = {
	onDebouncedChange: (value: string) => void;
	results: Result[];
	loading: boolean;
};

function SearchInput({ onDebouncedChange, results, loading }: InputProps) {
	const [value, setValue] = useState("");
	const [debounced] = useDebouncedValue(value, 300);
	const navigate = useNavigate();
	const combobox = useCombobox();
	const inputRef = useRef<HTMLInputElement>(null);
	const prevResultsRef = useRef<Result[]>([]);

	// Notify parent of debounced value changes
	useEffect(() => {
		onDebouncedChange(debounced);
	}, [debounced, onDebouncedChange]);

	const movies = useMemo(
		() => results.filter((r) => r.mediaType === "movie"),
		[results],
	);
	const tvShows = useMemo(
		() => results.filter((r) => r.mediaType === "tv"),
		[results],
	);

	const formatResultLabel = (item: Result) =>
		item.year ? `${item.label} (${item.year})` : item.label;

	const handleSelect = (optionValue: string) => {
		const selected = results.find((r) => String(r.id) === optionValue);
		if (!selected) return;

		// Clear the search input and remove focus
		setValue("");
		inputRef.current?.blur();

		// Navigate to the route - the loader will handle fetching data
		const titleSlug = selected.label
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		navigate({
			to: "/$mediaType/$identifier",
			params: {
				mediaType: selected.mediaType,
				identifier: `${selected.id}-${titleSlug}`,
			},
		});

		combobox.closeDropdown();
	};

	// Open dropdown when new results arrive
	useEffect(() => {
		if (
			results !== prevResultsRef.current &&
			results.length > 0 &&
			value.length > 0
		) {
			combobox.openDropdown();
		}
		prevResultsRef.current = results;
	}, [results, value.length, combobox]);

	return (
		<Combobox store={combobox} onOptionSubmit={handleSelect}>
			<Combobox.Target>
				<TextInput
					ref={inputRef}
					value={value}
					onChange={(e) => setValue(e.currentTarget.value)}
					placeholder="Search for movies or TV shows..."
					rightSection={loading ? <Loader size="xs" /> : null}
				/>
			</Combobox.Target>

			<Combobox.Dropdown>
				<Combobox.Options>
					{movies.length > 0 && (
						<Combobox.Group label="Movies">
							{movies.map((item) => (
								<Combobox.Option key={item.id} value={String(item.id)}>
									<Stack gap={2}>
										<Text fw="bold" size="sm">
											{formatResultLabel(item)}
										</Text>
										{item.subtitle && (
											<Text size="xs" c="dimmed">
												{item.subtitle}
											</Text>
										)}
									</Stack>
								</Combobox.Option>
							))}
						</Combobox.Group>
					)}

					{tvShows.length > 0 && (
						<Combobox.Group label="TV Shows">
							{tvShows.map((item) => (
								<Combobox.Option key={item.id} value={String(item.id)}>
									<Stack gap={2}>
										<Text fw="bold" size="sm">
											{formatResultLabel(item)}
										</Text>
										{item.subtitle && (
											<Text size="xs" c="dimmed">
												{item.subtitle}
											</Text>
										)}
									</Stack>
								</Combobox.Option>
							))}
						</Combobox.Group>
					)}

					{movies.length === 0 && tvShows.length === 0 && !loading && (
						<Combobox.Empty>No results</Combobox.Empty>
					)}
				</Combobox.Options>
			</Combobox.Dropdown>
		</Combobox>
	);
}

export default memo(SearchInput);
