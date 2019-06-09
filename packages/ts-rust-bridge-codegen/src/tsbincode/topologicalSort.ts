// ### Inspired by:

// https://leetcode.com/problems/course-schedule-ii/description/

// There are a total of n courses you have to take, labeled from 0 to n-1.

// Some courses may have prerequisites, for example to take course 0 you have to first take course 1, which is expressed as a pair: [0,1]

// Given the total number of courses and a list of prerequisite pairs, return the ordering of courses you should take to finish all courses.

// There may be multiple correct orders, you just need to return one of them. If it is impossible to finish all courses, return an empty array.

// Example 1:

// Input: 2, [[1,0]]
// Output: [0,1]
// Explanation: There are a total of 2 courses to take. To take course 1 you should have finished
//              course 0. So the correct course order is [0,1] .

// Example 2:

// Input: 4, [[1,0],[2,0],[3,1],[3,2]]
// Output: [0,1,2,3] or [0,2,1,3]
// Explanation: There are a total of 4 courses to take. To take course 3 you should have finished both
//              courses 1 and 2. Both courses 1 and 2 should be taken after you finished course 0.
//              So one correct course order is [0,1,2,3]. Another correct ordering is [0,2,1,3] .

// ### Note this is an adaptation
type Edge = [string, string];
type DependencyMap = Map<string, Set<string>>;
type Computation = { res: boolean; seq: Set<string> };
export const findOrder = (
  allElements: string[],
  dependencies: Edge[]
): string[] => {
  const courseMap = dependencies.reduce<DependencyMap>(
    (m, [toTake, required]) =>
      m.set(toTake, (m.get(toTake) || new Set<string>()).add(required)),
    allElements.reduce<DependencyMap>(
      (m, c) => m.set(c, new Set<string>()),
      new Map<string, Set<string>>()
    )
  );

  return Array.from(
    Array.from(courseMap.keys()).reduce<Computation>(
      aggregate(courseMap, new Set<string>()),
      { res: true, seq: new Set<string>() }
    ).seq
  );
};

const aggregate = (dependencyMap: DependencyMap, pending: Set<string>) => (
  { res, seq }: Computation,
  element: string
) =>
  res
    ? seq.has(element)
      ? { res, seq }
      : completeElementTraversal(element, dependencyMap, pending, seq)
    : { res: false, seq: new Set<string>() };

const completeElementTraversal = (
  element: string,
  dependencyMap: DependencyMap,
  pending: Set<string>,
  seq: Set<string>
): Computation => {
  const deps = dependencyMap.get(element);
  if (!deps) {
    return { res: true, seq: seq.add(element) };
  }

  if (pending.has(element)) {
    return { res: false, seq };
  }

  pending.add(element);

  const { res, seq: s } = Array.from(deps.values()).reduce<Computation>(
    aggregate(dependencyMap, pending),
    { res: true, seq }
  );

  pending.delete(element);
  dependencyMap.delete(element);

  return { res, seq: s.add(element) };
};
