/**
 * Android date+time picker helper.
 *
 * The `@react-native-community/datetimepicker` component form does NOT support
 * `mode="datetime"` on Android — rendering `<DateTimePicker mode="datetime" />`
 * there crashes on unmount with `TypeError: Cannot read property 'dismiss' of
 * undefined` (the component's cleanup calls into a native method that only the
 * iOS path provides). The supported Android approach is the imperative
 * `DateTimePickerAndroid.open()` API, called once for the date and then chained
 * for the time.
 *
 * iOS keeps using the inline `<DateTimePicker mode="datetime">` component; this
 * helper is Android-only.
 */

import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export function openAndroidDateTime(opts: {
  value: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => void;
}): void {
  const { value, maximumDate, onConfirm } = opts;

  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    maximumDate,
    onChange: (dateEvent, pickedDate) => {
      if (dateEvent.type !== 'set' || !pickedDate) return;

      // Chain to the time picker, seeded with the chosen date.
      DateTimePickerAndroid.open({
        value: pickedDate,
        mode: 'time',
        onChange: (timeEvent, pickedTime) => {
          if (timeEvent.type !== 'set' || !pickedTime) return;

          const combined = new Date(pickedDate);
          combined.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);

          // Never allow a future timestamp when a max is set.
          const final = maximumDate && combined > maximumDate ? maximumDate : combined;
          onConfirm(final);
        },
      });
    },
  });
}
