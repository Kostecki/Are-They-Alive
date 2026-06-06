import { createFileRoute, notFound } from "@tanstack/react-router";
import type { MovieDetails } from "tmdb-ts/dist/types/movies";
import type { TvShowDetails } from "tmdb-ts/dist/types/tv-shows";

import HomePageLayout from "~/components/HomePageLayout";
import SearchForm from "~/components/SearchForm";
import { getApiClient, getApiPath } from "~/utils/api";
import { mapApiDetailsToResult } from "~/utils/helpers";
import { seo } from "~/utils/seo";

export const Route = createFileRoute("/$mediaType/$identifier")({
	loader: async ({ params }) => {
		const { mediaType, identifier } = params;
		const id = Number(identifier.split("-")[0]);

		if (mediaType !== "movie" && mediaType !== "tv") {
			throw notFound();
		}

		try {
			const client = getApiClient();
			const details = await client
				.get(getApiPath(`api/${mediaType}/${id}`))
				.json<MovieDetails | (TvShowDetails & { imdb_id: string | null })>();
			const result = mapApiDetailsToResult(details, mediaType);

			return { item: result };
		} catch (error) {
			console.error("Error loading item details:", error);
			throw error;
		}
	},
	head: ({ loaderData }) => {
		if (!loaderData?.item) return {};

		const description = loaderData.item.overview
			? `${loaderData.item.overview} Find out how life treated the cast of your favorite films and shows.`
			: "Find out how life treated the cast of your favorite films and shows.";

		return {
			meta: seo({
				title: `Are They Alive? | ${loaderData.item.label}`,
				description,
			}),
		};
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { item } = Route.useLoaderData();

	return (
		<HomePageLayout>
			<SearchForm mt="xl" initialItem={item} />
		</HomePageLayout>
	);
}
