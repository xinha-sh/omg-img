import { StackContext, use } from "sst/constructs";
import { Aspects, Aws, CfnMapping, CfnOutput, CfnParameter, Tags } from "aws-cdk-lib";
import { PriceClass } from "aws-cdk-lib/aws-cloudfront";
import { ImageBackEnd } from "./lib/back-end/image-backend-construct.js";
import { CommonResources } from "./lib/common-resources/common-resources.js";
import { ServerlessImageHandlerStackProps, SolutionConstructProps, YesNo } from "./lib/types.js";
import { SuppressLambdaFunctionCfnRulesAspect } from "./lib/utils/aspect.js";
import { StorageStack } from "./StorageStack.js";

const getProps = (): ServerlessImageHandlerStackProps => {
  const {
    SOLUTION_BUCKET_NAME_PLACEHOLDER,
    SOLUTION_NAME_PLACEHOLDER,
    SOLUTION_VERSION_PLACEHOLDER,
  } = process.env;

  if (
    typeof SOLUTION_BUCKET_NAME_PLACEHOLDER !== "string" ||
    SOLUTION_BUCKET_NAME_PLACEHOLDER.trim() === ""
  ) {
    throw new Error(
      "Missing required environment variable: SOLUTION_BUCKET_NAME_PLACEHOLDER"
    );
  }

  if (
    typeof SOLUTION_NAME_PLACEHOLDER !== "string" ||
    SOLUTION_NAME_PLACEHOLDER.trim() === ""
  ) {
    throw new Error(
      "Missing required environment variable: SOLUTION_NAME_PLACEHOLDER"
    );
  }

  if (
    typeof SOLUTION_VERSION_PLACEHOLDER !== "string" ||
    SOLUTION_VERSION_PLACEHOLDER.trim() === ""
  ) {
    throw new Error(
      "Missing required environment variable: SOLUTION_VERSION_PLACEHOLDER"
    );
  }

  const solutionId = "SO0023";
  const solutionDisplayName = "Serverless Image Handler";
  const solutionVersion = SOLUTION_VERSION_PLACEHOLDER;
  const solutionName = SOLUTION_NAME_PLACEHOLDER;
  const solutionAssetHostingBucketNamePrefix = SOLUTION_BUCKET_NAME_PLACEHOLDER;
  const description = `(${solutionId}) - ${solutionDisplayName}. Version ${solutionVersion}`;

  return {
    description,
    solutionId,
    solutionName,
    solutionDisplayName,
    solutionVersion,
    solutionAssetHostingBucketNamePrefix,
  };
};

export function ImageStack({ stack }: StackContext) {
  const { bucket } = use(StorageStack);
  const additionalProps = getProps()



  const corsEnabledParameter = new CfnParameter(
    stack,
    "CorsEnabledParameter",
    {
      type: "String",
      description: `Would you like to enable Cross-Origin Resource Sharing (CORS) for the image handler API? Select 'Yes' if so.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    }
  );

  const corsOriginParameter = new CfnParameter(stack, "CorsOriginParameter", {
    type: "String",
    description: `If you selected 'Yes' above, please specify an origin value here. A wildcard (*) value will support any origin. We recommend specifying an origin (i.e. https://example.domain) to restrict cross-site access to your API.`,
    default: "*",
  });

  const sourceBucketsParameter = new CfnParameter(
    stack,
    "SourceBucketsParameter",
    {
      type: "String",
      description:
        "(Required) List the buckets (comma-separated) within your account that contain original image files. If you plan to use Thumbor or Custom image requests with this solution, the source bucket for those requests will be the first bucket listed in this field.",
      allowedPattern: ".+",
      default: "defaultBucket, bucketNo2, bucketNo3, ...",
    }
  );

  const logRetentionPeriodParameter = new CfnParameter(
    stack,
    "LogRetentionPeriodParameter",
    {
      type: "Number",
      description:
        "This solution automatically logs events to Amazon CloudWatch. Select the amount of time for CloudWatch logs from this solution to be retained (in days).",
      allowedValues: [
        "1",
        "3",
        "5",
        "7",
        "14",
        "30",
        "60",
        "90",
        "120",
        "150",
        "180",
        "365",
        "400",
        "545",
        "731",
        "1827",
        "3653",
      ],
      default: "1",
    }
  );

  const autoWebPParameter = new CfnParameter(stack, "AutoWebPParameter", {
    type: "String",
    description: `Would you like to enable automatic WebP based on accept headers? Select 'Yes' if so.`,
    allowedValues: ["Yes", "No"],
    default: "Yes",
  });

  const enableSignatureParameter = new CfnParameter(
    stack,
    "EnableSignatureParameter",
    {
      type: "String",
      description: `Would you like to enable the signature? If so, select 'Yes' and provide SecretsManagerSecret and SecretsManagerKey values.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    }
  );

  const secretsManagerSecretParameter = new CfnParameter(
    stack,
    "SecretsManagerSecretParameter",
    {
      type: "String",
      description:
        "The name of AWS Secrets Manager secret. You need to create your secret under this name.",
      default: "",
    }
  );

  const secretsManagerKeyParameter = new CfnParameter(
    stack,
    "SecretsManagerKeyParameter",
    {
      type: "String",
      description:
        "The name of AWS Secrets Manager secret key. You need to create secret key with this key name. The secret value would be used to check signature.",
      default: "",
    }
  );


  const enableDefaultFallbackImageParameter = new CfnParameter(
    stack,
    "EnableDefaultFallbackImageParameter",
    {
      type: "String",
      description: `Would you like to enable the default fallback image? If so, select 'Yes' and provide FallbackImageS3Bucket and FallbackImageS3Key values.`,
      allowedValues: ["Yes", "No"],
      default: "No",
    }
  );

  const fallbackImageS3BucketParameter = new CfnParameter(
    stack,
    "FallbackImageS3BucketParameter",
    {
      type: "String",
      description:
        "The name of the Amazon S3 bucket which contains the default fallback image. e.g. my-fallback-image-bucket",
      default: "",
    }
  );

  const fallbackImageS3KeyParameter = new CfnParameter(
    stack,
    "FallbackImageS3KeyParameter",
    {
      type: "String",
      description:
        "The name of the default fallback image object key including prefix. e.g. prefix/image.jpg",
      default: "",
    }
  );

  const cloudFrontPriceClassParameter = new CfnParameter(
    stack,
    "CloudFrontPriceClassParameter",
    {
      type: "String",
      description:
        "The AWS CloudFront price class to use. For more information see: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PriceClass.html",
      allowedValues: [
        PriceClass.PRICE_CLASS_ALL,
        PriceClass.PRICE_CLASS_200,
        PriceClass.PRICE_CLASS_100,
      ],
      default: PriceClass.PRICE_CLASS_ALL,
    }
  );

  const solutionMapping = new CfnMapping(stack, "Solution", {
    mapping: {
      Config: {
        AnonymousUsage: "Yes",
        SolutionId: additionalProps.solutionId,
        Version: additionalProps.solutionVersion,
        S3BucketPrefix: additionalProps.solutionAssetHostingBucketNamePrefix,
        S3KeyPrefix: `${additionalProps.solutionName}/${additionalProps.solutionVersion}`,
      },
    },
    lazy: true,
  });

  const anonymousUsage = `${solutionMapping.findInMap("Config", "AnonymousUsage")}`;
  const sourceCodeBucketName = `${solutionMapping.findInMap("Config", "S3BucketPrefix")}-${Aws.REGION}`;
  const sourceCodeKeyPrefix = solutionMapping.findInMap("Config", "S3KeyPrefix");

  const solutionConstructProps: SolutionConstructProps = {
    corsEnabled: corsEnabledParameter.valueAsString,
    corsOrigin: corsOriginParameter.valueAsString,
    sourceBuckets: sourceBucketsParameter.valueAsString,
    logRetentionPeriod: logRetentionPeriodParameter.valueAsNumber,
    autoWebP: autoWebPParameter.valueAsString,
    enableSignature: enableSignatureParameter.valueAsString as YesNo,
    secretsManager: secretsManagerSecretParameter.valueAsString,
    secretsManagerKey: secretsManagerKeyParameter.valueAsString,
    enableDefaultFallbackImage:
      enableDefaultFallbackImageParameter.valueAsString as YesNo,
    fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
    fallbackImageS3KeyBucket: fallbackImageS3KeyParameter.valueAsString,
  };

  const commonResources = new CommonResources(stack, "CommonResources", {
    solutionId: additionalProps.solutionId,
    solutionVersion: additionalProps.solutionVersion,
    solutionDisplayName: additionalProps.solutionDisplayName,
    ...solutionConstructProps,
  });

  // const backEnd = new ImageBackEnd(stack, "BackEnd", {
  //   solutionVersion: additionalProps.solutionVersion,
  //   solutionDisplayName: additionalProps.solutionDisplayName,
  //   secretsManagerPolicy: commonResources.secretsManagerPolicy,
  //   logsBucket: commonResources.logsBucket,
  //   uuid: commonResources.customResources.uuid,
  //   cloudFrontPriceClass: cloudFrontPriceClassParameter.valueAsString,
  //   ...solutionConstructProps,
  // });

  // commonResources.customResources.setupAnonymousMetric({
  //   anonymousData: anonymousUsage,
  //   ...solutionConstructProps,
  // });

  // commonResources.customResources.setupValidateSourceAndFallbackImageBuckets({
  //   sourceBuckets: sourceBucketsParameter.valueAsString,
  //   fallbackImageS3Bucket: fallbackImageS3BucketParameter.valueAsString,
  //   fallbackImageS3Key: fallbackImageS3KeyParameter.valueAsString,
  // });

  // commonResources.customResources.setupValidateSecretsManager({
  //   secretsManager: secretsManagerSecretParameter.valueAsString,
  //   secretsManagerKey: secretsManagerKeyParameter.valueAsString,
  // });

  // commonResources.appRegistryApplication({
  //   description: additionalProps.description,
  //   solutionVersion: additionalProps.solutionVersion,
  //   solutionId: additionalProps.solutionId,
  //   applicationName: additionalProps.solutionName,
  // });

  // stack.templateOptions.metadata = {
  //   "AWS::CloudFormation::Interface": {
  //     ParameterGroups: [
  //       {
  //         Label: { default: "CORS Options" },
  //         Parameters: [corsEnabledParameter.logicalId, corsOriginParameter.logicalId],
  //       },
  //       {
  //         Label: { default: "Image Sources" },
  //         Parameters: [sourceBucketsParameter.logicalId],
  //       },
  //       {
  //         Label: { default: "Event Logging" },
  //         Parameters: [logRetentionPeriodParameter.logicalId],
  //       },
  //       {
  //         Label: {
  //           default:
  //             "Image URL Signature (Note: Enabling signature is not compatible with previous image URLs, which could result in broken image links. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/considerations.html)",
  //         },
  //         Parameters: [
  //           enableSignatureParameter.logicalId,
  //           secretsManagerSecretParameter.logicalId,
  //           secretsManagerKeyParameter.logicalId,
  //         ],
  //       },
  //       {
  //         Label: {
  //           default:
  //             "Default Fallback Image (Note: Enabling default fallback image returns the default fallback image instead of JSON object when error happens. Please refer to the implementation guide for details: https://docs.aws.amazon.com/solutions/latest/serverless-image-handler/considerations.html)",
  //         },
  //         Parameters: [
  //           enableDefaultFallbackImageParameter.logicalId,
  //           fallbackImageS3BucketParameter.logicalId,
  //           fallbackImageS3KeyParameter.logicalId,
  //         ],
  //       },
  //       {
  //         Label: { default: "Auto WebP" },
  //         Parameters: [autoWebPParameter.logicalId],
  //       },
  //     ],
  //     ParameterLabels: {
  //       [corsEnabledParameter.logicalId]: { default: "CORS Enabled" },
  //       [corsOriginParameter.logicalId]: { default: "CORS Origin" },
  //       [sourceBucketsParameter.logicalId]: { default: "Source Buckets" },
  //       [logRetentionPeriodParameter.logicalId]: {
  //         default: "Log Retention Period",
  //       },
  //       [autoWebPParameter.logicalId]: { default: "AutoWebP" },
  //       [enableSignatureParameter.logicalId]: { default: "Enable Signature" },
  //       [secretsManagerSecretParameter.logicalId]: {
  //         default: "SecretsManager Secret",
  //       },
  //       [secretsManagerKeyParameter.logicalId]: {
  //         default: "SecretsManager Key",
  //       },
  //       [enableDefaultFallbackImageParameter.logicalId]: {
  //         default: "Enable Default Fallback Image",
  //       },
  //       [fallbackImageS3BucketParameter.logicalId]: {
  //         default: "Fallback Image S3 Bucket",
  //       },
  //       [fallbackImageS3KeyParameter.logicalId]: {
  //         default: "Fallback Image S3 Key",
  //       },
  //       [cloudFrontPriceClassParameter.logicalId]: {
  //         default: "CloudFront PriceClass",
  //       },
  //     },
  //   },
  // }

  /* eslint-disable no-new */
  // new CfnOutput(stack, "ApiEndpoint", {
  //   value: `https://${backEnd.domainName}`,
  //   description: "Link to API endpoint for sending image requests to.",
  // });
  // new CfnOutput(stack, "SourceBuckets", {
  //   value: sourceBucketsParameter.valueAsString,
  //   description: "Amazon S3 bucket location containing original image files.",
  // });
  // new CfnOutput(stack, "CorsEnabled", {
  //   value: corsEnabledParameter.valueAsString,
  //   description: "Indicates whether Cross-Origin Resource Sharing (CORS) has been enabled for the image handler API.",
  // });
  // new CfnOutput(stack, "CorsOrigin", {
  //   value: corsOriginParameter.valueAsString,
  //   description: "Origin value returned in the Access-Control-Allow-Origin header of image handler API responses.",
  //   condition: commonResources.conditions.enableCorsCondition,
  // });
  // new CfnOutput(stack, "LogRetentionPeriod", {
  //   value: logRetentionPeriodParameter.valueAsString,
  //   description: "Number of days for event logs from Lambda to be retained in CloudWatch.",
  // });

  Aspects.of(stack).add(new SuppressLambdaFunctionCfnRulesAspect());
  Tags.of(stack).add("SolutionId", additionalProps.solutionId);

  // stack.addOutputs({
  //   Image_Handler_Url: backEnd.domainName,
  // });

}
