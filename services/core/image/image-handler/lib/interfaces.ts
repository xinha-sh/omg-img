// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import sharp, { WebpOptions } from "sharp";

import { ImageFormatType, RequestTypes, StatusCodes } from "./enums";
import { Headers, ImageEdits } from "./types";

export interface ImageHandlerEvent {
  path?: string;
  queryStringParameters?: {
    signature: string;
  };
  requestContext?: {
    elb?: unknown;
  };
  headers?: Headers;
}

export interface DefaultImageRequest {
  bucket?: string;
  key: string;
  edits?: ImageEdits;
  outputFormat?: ImageFormatType;
  reductionEffort?: number;
  headers?: Headers;
}

export interface BoundingBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface BoxSize {
  height: number;
  width: number;
}

export interface ImageRequestInfo {
  requestType: RequestTypes;
  bucket: string;
  key: string;
  edits: ImageEdits;
  originalImage: Buffer;
  headers?: Headers;
  contentType?: string;
  expires?: string;
  lastModified?: string;
  cacheControl?: string;
  outputFormat?: ImageFormatType;
  reductionEffort?: WebpOptions["effort"];
}

export interface RekognitionCompatibleImage {
  imageBuffer: {
    data: Buffer;
    info: sharp.OutputInfo;
  };
  format: keyof sharp.FormatEnum;
}

export interface ImageHandlerExecutionResult {
  statusCode: StatusCodes;
  isBase64Encoded: boolean;
  headers: Headers;
  body: string;
}
