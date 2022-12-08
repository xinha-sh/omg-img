import { StackProps } from "aws-cdk-lib";

export type YesNo = "Yes" | "No";

export interface SolutionConstructProps {
  readonly corsEnabled: string;
  readonly corsOrigin: string;
  readonly sourceBuckets: string;
  readonly logRetentionPeriod: number;
  readonly autoWebP: string;
  readonly enableSignature: YesNo;
  readonly secretsManager: string;
  readonly secretsManagerKey: string;
  readonly enableDefaultFallbackImage: YesNo;
  readonly fallbackImageS3Bucket: string;
  readonly fallbackImageS3KeyBucket: string;
}

export interface ServerlessImageHandlerStackProps extends StackProps {
  readonly description: string;
  readonly solutionId: string;
  readonly solutionName: string;
  readonly solutionVersion: string;
  readonly solutionDisplayName: string;
  readonly solutionAssetHostingBucketNamePrefix: string;
}
