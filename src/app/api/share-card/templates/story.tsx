import type { ReactNode } from "react";

import type { ShareCardConfig } from "@/lib/share/card-config";

import {
  Background,
  CardHeader,
  COLORS,
  PERIOD_LABEL,
  RankRow,
  SectionLabel,
  Stack,
  Watermark,
} from "./shared";

export const STORY_SIZE = { width: 1080, height: 1920 };

export type FocusItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
};

export type RecapData = {
  tracks: FocusItem[];
  artists: FocusItem[];
  albums: FocusItem[];
};

export type StoryProps = {
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

export function StoryTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
  hideWatermark,
}: StoryProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: STORY_SIZE.width,
        height: STORY_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg}
        width={STORY_SIZE.width}
        height={STORY_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 80,
          width: STORY_SIZE.width,
          height: STORY_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.4}
        />
        {config.mode === "focus" ? (
          <FocusSection
            label={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
            items={data as FocusItem[]}
          />
        ) : (
          <RecapSection
            data={data as RecapData}
            periodLabel={PERIOD_LABEL[config.period]}
          />
        )}
        <Watermark username={username} scale={1.2} hidden={hideWatermark} />
      </Stack>
    </div>
  );
}

function FocusSection({ label, items }: { label: string; items: FocusItem[] }) {
  return (
    <Stack style={{ marginTop: 70 }}>
      <SectionLabel text={label} scale={1.3} />
      <Stack style={{ marginTop: 20 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={1.4}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function RecapSection({
  data,
  periodLabel,
}: {
  data: RecapData;
  periodLabel: string;
}) {
  return (
    <Stack style={{ marginTop: 60, gap: 50 }}>
      <RecapBlock
        label={`TOP TITRES · ${periodLabel.toUpperCase()}`}
        items={data.tracks}
      />
      <RecapBlock label="TOP ARTISTES" items={data.artists} />
      <RecapBlock label="TOP ALBUMS" items={data.albums} />
    </Stack>
  );
}

function RecapBlock({
  label,
  items,
}: {
  label: string;
  items: FocusItem[];
}) {
  return (
    <Stack>
      <SectionLabel text={label} scale={1.1} />
      <Stack style={{ marginTop: 12 }}>
        {items.map((item, i) => (
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
  );
}
