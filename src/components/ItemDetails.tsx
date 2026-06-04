import {
	Box,
	type BoxProps,
	Button,
	Flex,
	Grid,
	Image,
	Text,
} from "@mantine/core";

import type { Result } from "~/types";

type InputProps = {
	item: Result;
} & BoxProps;

const formatItemTitle = (item: Result) =>
	item.year ? `${item.label} (${item.year})` : item.label;

export default function ItemDetails({ item, ...props }: InputProps) {
	return (
		<Box {...props}>
			<Grid>
				<Grid.Col span={3}>
					<Image
						src={
							item.poster_path
								? `https://image.tmdb.org/t/p/w185${item.poster_path}`
								: undefined
						}
						alt={item.label}
						w="100%"
						maw={185}
						fit="contain"
						loading="lazy"
					/>
				</Grid.Col>
				<Grid.Col span="auto">
					<Box>
						<Text fw={700}>
							{formatItemTitle(item)} {item.countries?.join(" ")}
						</Text>
						{item.subtitle && <Text c="dimmed">{item.subtitle}</Text>}
						<Flex gap="sm">
							<Button
								component="a"
								variant="outline"
								size="xs"
								href={`https://www.themoviedb.org/${item.mediaType}/${item.id}`}
								target="_blank"
								rel="noopener noreferrer"
								mt="xs"
								color="var(--mantine-color-gray-6)"
							>
								TMDB
							</Button>
							<Button
								component="a"
								variant="outline"
								size="xs"
								href={`https://www.imdb.com/title/${item.imdb_id}`}
								target="_blank"
								rel="noopener noreferrer"
								mt="xs"
								color="var(--mantine-color-gray-6)"
							>
								IMDB
							</Button>
						</Flex>
						<Text
							mt="sm"
							lineClamp={8}
							style={{ wordWrap: "break-word", whiteSpace: "break-spaces" }}
						>
							{item.overview}
						</Text>
					</Box>
				</Grid.Col>
			</Grid>
		</Box>
	);
}
