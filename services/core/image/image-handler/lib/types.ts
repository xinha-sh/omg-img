// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Rekognition } from "aws-sdk";
import { Region, ResizeOptions } from "sharp";
import { ImageFormatType, StatusCodes } from "./enums";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Headers = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ImageEdits = {
  resize: ResizeOptions;
  overlayWith: {
    bucket: string;
    key: string;
    wRatio: string;
    hRatio: string;
    alpha: string;
    options: Record<string, any>;
  };
  rotate?: boolean | string | number | null;
  crop: Region;
  smartCrop:
    | boolean
    | {
        faceIndex: number;
        padding: number;
      };
  roundCrop:
    | boolean
    | {
        top?: number;
        left?: number;
        rx?: number;
        ry?: number;
      };
  contentModeration:
    | boolean
    | {
        minConfidence: Rekognition.ModerationLabel["Confidence"];
        blur: number;
        moderationLabels: Rekognition.ModerationLabel["Name"][];
      };
  toFormat: ImageFormatType;
  flatten: {
    background: { alpha?: number | undefined } & { [key: string]: number };
  };
  blur: number;
  convolve: {
    width: number;
    height: number;
    kernel: number[];
  };
  normalize: boolean;
  grayscale: boolean;
  tint: {
    r: number;
    g: number;
    b: number;
  };
  sharpen: number;
} & Partial<{
  [key in ImageFormatType]?: any;
}>;

export class ImageHandlerError extends Error {
  constructor(
    public readonly status: StatusCodes,
    public readonly code: string,
    public readonly message: string
  ) {
    super();
  }
}
