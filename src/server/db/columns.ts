import { customType } from "drizzle-orm/sqlite-core";

export const decimalText = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

export const dateTimeText = customType<{
  data: Date | null;
  driverData: string | null;
}>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  },
  fromDriver(value) {
    if (!value) return null;
    return new Date(value);
  },
});
