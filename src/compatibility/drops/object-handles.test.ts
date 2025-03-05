import ObjectHandlesDrop from './object-handles';

interface ObjectHandle {
  handle: string;
}

describe('compatibility/drops/object-handles', () => {
  it('should accept objects with handle property as keys', () => {
    const object1: ObjectHandle = { handle: 'object-1' };
    const object2: ObjectHandle = { handle: 'object-2' };
    const missing: ObjectHandle = { handle: 'missing' };

    const map: Record<string, ObjectHandle> = {
      [object1.handle]: object1,
      [object2.handle]: object2,
    };

    const handles = new ObjectHandlesDrop<ObjectHandle>(map);

    expect(handles.liquidMethodMissing(object1.handle)).toStrictEqual(object1);
    expect(handles.liquidMethodMissing(object1)).toStrictEqual(object1);
    expect(handles.liquidMethodMissing(object2.handle)).toStrictEqual(object2);
    expect(handles.liquidMethodMissing(object2)).toStrictEqual(object2);
    expect(handles.liquidMethodMissing(missing.handle)).toBeUndefined();
    expect(handles.liquidMethodMissing(missing)).toBeUndefined();
  });
});
