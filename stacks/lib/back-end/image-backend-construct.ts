import { CloudFrontToApiGatewayToLambda } from "@aws-solutions-constructs/aws-cloudfront-apigateway-lambda";
import { ArnFormat, Aws, Duration, Lazy, Stack } from "aws-cdk-lib";
import { LambdaRestApiProps, RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  AllowedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  DistributionProps,
  IOrigin,
  OriginRequestPolicy,
  OriginSslPolicy,
  PriceClass,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  Policy,
  PolicyStatement,
  Role,
  ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { Function } from "sst/constructs";
import { SolutionConstructProps } from "../types.js";
import { addCfnSuppressRules } from "../utils/index.js";

export interface ImageBackEndProps extends SolutionConstructProps {
  readonly solutionVersion: string;
  readonly solutionDisplayName: string;
  readonly secretsManagerPolicy: Policy;
  readonly logsBucket: IBucket;
  readonly uuid: string;
  readonly cloudFrontPriceClass: string;
}

export class ImageBackEnd extends Construct {
  public domainName: string;

  constructor(scope: Construct, id: string, props: ImageBackEndProps) {
    super(scope, id);

    const imageHandlerLambdaFunctionRole = new Role(
      this,
      "ImageHandlerFunctionRole",
      {
        assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
        path: "/",
      }
    );

    props.secretsManagerPolicy.attachToRole(imageHandlerLambdaFunctionRole);

    const imageHandlerLambdaFunctionRolePolicy = new Policy(
      this,
      "ImageHandlerFunctionPolicy",
      {
        statements: [
          new PolicyStatement({
            actions: [
              "logs:CreateLogGroup",
              "logs:CreateLogStream",
              "logs:PutLogEvents",
            ],
            resources: [
              Stack.of(this).formatArn({
                service: "logs",
                resource: "log-group",
                resourceName: "/aws/lambda/*",
                arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              }),
            ],
          }),
          new PolicyStatement({
            actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
            resources: [
              Stack.of(this).formatArn({
                service: "s3",
                resource: "*",
                region: "",
                account: "",
              }),
            ],
          }),
          new PolicyStatement({
            actions: [
              "rekognition:DetectFaces",
              "rekognition:DetectModerationLabels",
            ],
            resources: ["*"],
          }),
        ],
      }
    );

    addCfnSuppressRules(imageHandlerLambdaFunctionRolePolicy, [
      { id: "W12", reason: "rekognition:DetectFaces requires '*' resources." },
    ]);
    imageHandlerLambdaFunctionRole.attachInlinePolicy(
      imageHandlerLambdaFunctionRolePolicy
    );

    const imageHandlerLambdaFunction = new Function(
      this,
      "ImageHandlerLambdaFunction",
      {
        description: `${props.solutionDisplayName} (${props.solutionVersion}): Performs image edits and manipulations`,
        handler: "functions/image.handler",
        timeout: "15 minute",
        memorySize: 1_024,
        role: imageHandlerLambdaFunctionRole,
        environment: {
          AUTO_WEBP: props.autoWebP,
          CORS_ENABLED: props.corsEnabled,
          CORS_ORIGIN: props.corsOrigin,
          SOURCE_BUCKETS: props.sourceBuckets, // use(StorageStack)
          REWRITE_MATCH_PATTERN: "",
          REWRITE_SUBSTITUTION: "",
          ENABLE_SIGNATURE: props.enableSignature,
          SECRETS_MANAGER: props.secretsManager,
          SECRET_KEY: props.secretsManagerKey,
          ENABLE_DEFAULT_FALLBACK_IMAGE: props.enableDefaultFallbackImage,
          DEFAULT_FALLBACK_IMAGE_BUCKET: props.fallbackImageS3Bucket,
          DEFAULT_FALLBACK_IMAGE_KEY: props.fallbackImageS3KeyBucket,
        },
      }
    );

    const imageHandlerLogGroup = new LogGroup(this, "ImageHandlerLogGroup", {
      logGroupName: `/aws/lambda/${imageHandlerLambdaFunction.functionName}`,
      retention: props.logRetentionPeriod as RetentionDays,
    });

    addCfnSuppressRules(imageHandlerLogGroup, [
      {
        id: "W84",
        reason: "CloudWatch log group is always encrypted by default.",
      },
    ]);

    const cachePolicy = new CachePolicy(this, "CachePolicy", {
      cachePolicyName: `ServerlessImageHandler-${props.uuid}`,
      defaultTtl: Duration.days(1),
      minTtl: Duration.seconds(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      headerBehavior: CacheHeaderBehavior.allowList("origin", "accept"),
      queryStringBehavior: CacheQueryStringBehavior.allowList("signature"),
    });

    const originRequestPolicy = new OriginRequestPolicy(
      this,
      "OriginRequestPolicy",
      {
        originRequestPolicyName: `ServerlessImageHandler-${props.uuid}`,
        headerBehavior: CacheHeaderBehavior.allowList("origin", "accept"),
        queryStringBehavior: CacheQueryStringBehavior.allowList("signature"),
      }
    );

    const apiGatewayRestApi = RestApi.fromRestApiId(
      this,
      "ApiGatewayRestApi",
      Lazy.string({
        produce: () =>
          imageHandlerCloudFrontApiGatewayLambda.apiGateway.restApiId,
      })
    );

    const origin: IOrigin = new HttpOrigin(
      `${apiGatewayRestApi.restApiId}.execute-api.${Aws.REGION}.amazonaws.com`,
      {
        originPath: "/image",
        originSslProtocols: [
          OriginSslPolicy.TLS_V1_1,
          OriginSslPolicy.TLS_V1_2,
        ],
      }
    );

    const cloudFrontDistributionProps: DistributionProps = {
      comment: "Image Handler Distribution for Serverless Image Handler",
      defaultBehavior: {
        origin: origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        originRequestPolicy: originRequestPolicy,
        cachePolicy: cachePolicy,
      },
      priceClass: props.cloudFrontPriceClass as PriceClass,
      enableLogging: true,
      logBucket: props.logsBucket,
      logFilePrefix: "api-cloudfront/",
      errorResponses: [
        { httpStatus: 500, ttl: Duration.minutes(10) },
        { httpStatus: 501, ttl: Duration.minutes(10) },
        { httpStatus: 502, ttl: Duration.minutes(10) },
        { httpStatus: 503, ttl: Duration.minutes(10) },
        { httpStatus: 504, ttl: Duration.minutes(10) },
      ],
    };

    const logGroupProps = {
      retention: props.logRetentionPeriod as RetentionDays,
    };

    const apiGatewayProps: LambdaRestApiProps = {
      handler: imageHandlerLambdaFunction,
      deployOptions: {
        stageName: "image",
      },
      binaryMediaTypes: ["*/*"],
    };

    const imageHandlerCloudFrontApiGatewayLambda =
      new CloudFrontToApiGatewayToLambda(
        this,
        "ImageHandlerCloudFrontApiGatewayLambda",
        {
          existingLambdaObj: imageHandlerLambdaFunction,
          insertHttpSecurityHeaders: false,
          logGroupProps: logGroupProps,
          cloudFrontDistributionProps: cloudFrontDistributionProps,
          apiGatewayProps: apiGatewayProps,
        }
      );

    imageHandlerCloudFrontApiGatewayLambda.apiGateway.node.tryRemoveChild(
      "Endpoint"
    ); // we don't need the RestApi endpoint in the outputs

    this.domainName =
      imageHandlerCloudFrontApiGatewayLambda.cloudFrontWebDistribution.distributionDomainName;
  }
}
