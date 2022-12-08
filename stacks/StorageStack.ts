import { Bucket, StackContext } from "sst/constructs";

export function StorageStack({ stack }: StackContext) {
  const bucket = new Bucket(stack, "Bucket");

  bucket.attachPermissions([bucket]);

  stack.addOutputs({
    S3_Bucket: bucket.bucketName,
  });

  return { bucket };
}
