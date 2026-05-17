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

export const TWITTER_SIZE = { width: 1200, height: 630 };

export type TwitterProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
};

const LABEL_BY_TYPE: Record<"tracks" | "artists" | "albums", string> = {
  tracks: "Top titres",
  artists: "Top artistes",
  albums: "Top albums",
};

export function TwitterTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
}: TwitterProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: TWITTER_SIZE.width,
        height: TWITTER_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg}
        width={TWITTER_SIZE.width}
        height={TWITTER_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 50,
          width: TWITTER_SIZE.width,
          height: TWITTER_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.0}
        />
        {config.mode === "focus" ? (
          <Stack style={{ marginTop: 30 }}>
            <SectionLabel
              text={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
              scale={1.0}
            />
            <Stack style={{ marginTop: 10 }}>
              {(data as FocusItem[]).map((item, i) => (
                <RankRow
                  key={item.id}
                  rank={i + 1}
                  title={item.title}
                  subtitle={item.subtitle}
                  imageUrl={item.imageUrl}
                  scale={1.0}
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
        <Watermark username={username} scale={1.0} />
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
    <HStack style={{ marginTop: 24, gap: 40, alignItems: "flex-start" }}>
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
      <SectionLabel text={label} scale={0.8} />
      <Stack style={{ marginTop: 6 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={0.7}
          />
        ))}
      </Stack>
    </Stack>
  );
}
