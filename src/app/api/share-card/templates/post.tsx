import type { ReactNode } from "react";

import type { ShareCardConfig } from "@/lib/share/card-config";

import {
  Background,
  CardHeader,
  COLORS,
  HStack,
  PERIOD_LABEL,
  RankRow,
  SectionLabel,
  Stack,
  Watermark,
} from "./shared";
import type { FocusItem, RecapData } from "./story";

export const POST_SIZE = { width: 1080, height: 1080 };

export type PostProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
  hideWatermark?: boolean;
};

const LABEL_BY_TYPE: Record<"tracks" | "artists" | "albums", string> = {
  tracks: "Top titres",
  artists: "Top artistes",
  albums: "Top albums",
};

export function PostTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
  hideWatermark,
}: PostProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: POST_SIZE.width,
        height: POST_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg}
        width={POST_SIZE.width}
        height={POST_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 60,
          width: POST_SIZE.width,
          height: POST_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.1}
        />
        {config.mode === "focus" ? (
          <Stack style={{ marginTop: 40 }}>
            <SectionLabel
              text={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
              scale={1.0}
            />
            <Stack style={{ marginTop: 12 }}>
              {(data as FocusItem[]).map((item, i) => (
                <RankRow
                  key={item.id}
                  rank={i + 1}
                  title={item.title}
                  subtitle={item.subtitle}
                  imageUrl={item.imageUrl}
                  scale={1.05}
                />
              ))}
            </Stack>
          </Stack>
        ) : (
          <RecapColumns
            data={data as RecapData}
            periodLabel={PERIOD_LABEL[config.period]}
          />
        )}
        <Watermark username={username} scale={1.0} hidden={hideWatermark} />
      </Stack>
    </div>
  );
}

function RecapColumns({
  data,
  periodLabel,
}: {
  data: RecapData;
  periodLabel: string;
}) {
  return (
    <HStack style={{ marginTop: 30, gap: 28, alignItems: "flex-start" }}>
      <RecapColumn label={`TITRES · ${periodLabel.toUpperCase()}`} items={data.tracks} />
      <RecapColumn label="ARTISTES" items={data.artists} />
      <RecapColumn label="ALBUMS" items={data.albums} />
    </HStack>
  );
}

function RecapColumn({
  label,
  items,
}: {
  label: string;
  items: FocusItem[];
}) {
  return (
    <Stack style={{ flex: 1 }}>
      <SectionLabel text={label} scale={0.85} />
      <Stack style={{ marginTop: 8 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={0.8}
          />
        ))}
      </Stack>
    </Stack>
  );
}
