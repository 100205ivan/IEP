interface ReferenceMetric { mean: number; sd: number }
interface CptNorm { hit: ReferenceMetric; omission: ReferenceMetric; commission: ReferenceMetric; rt: ReferenceMetric }

export const CPT_NORMS: Record<number, CptNorm> = {
  5:{hit:{mean:.66,sd:.23},omission:{mean:22.74,sd:16.45},commission:{mean:2.89,sd:4.25},rt:{mean:769,sd:58}},
  6:{hit:{mean:.81,sd:.12},omission:{mean:13.29,sd:8.65},commission:{mean:1.62,sd:2},rt:{mean:737,sd:53}},
  7:{hit:{mean:.96,sd:.04},omission:{mean:2.24,sd:2.48},commission:{mean:1.46,sd:1.48},rt:{mean:623,sd:69}},
  8:{hit:{mean:.98,sd:.03},omission:{mean:1.52,sd:2.05},commission:{mean:.9,sd:1.22},rt:{mean:599,sd:66}},
  9:{hit:{mean:.98,sd:.02},omission:{mean:1.27,sd:1.63},commission:{mean:1.37,sd:1.82},rt:{mean:551,sd:60}},
  10:{hit:{mean:.99,sd:.02},omission:{mean:.75,sd:1.38},commission:{mean:.96,sd:1.1},rt:{mean:519,sd:56}},
  11:{hit:{mean:.99,sd:.01},omission:{mean:.63,sd:1.07},commission:{mean:1.28,sd:1.56},rt:{mean:419,sd:52}},
  12:{hit:{mean:1,sd:.01},omission:{mean:.37,sd:.74},commission:{mean:.85,sd:1.17},rt:{mean:483,sd:61}}
};
